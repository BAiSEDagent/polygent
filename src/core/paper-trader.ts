import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { evaluateRisk } from './risk';
import { liveDataService, OrderBook } from './live-data';
import { agentStore } from '../models/agent';
import { tradeStore } from '../models/trade';
import { broadcastTrade } from './data-feed';
import { Agent, Signal, Trade, Order, OrderRequest } from '../utils/types';
import { getAgentMutex } from '../utils/mutex';

/**
 * Paper Trading Engine
 *
 * Simulates order execution against live orderbook data.
 * Tracks virtual positions, P&L, and trade history per agent.
 * Uses the same risk engine as real trading.
 */

export interface PaperTrade {
  id: string;
  agentId: string;
  strategyName: string;
  marketId: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  requestedPrice: number;
  executedPrice: number;
  amount: number;
  notional: number;
  reasoning: string;
  timestamp: number;
  slippage: number;
}

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentEquity: number;
  depositedEquity: number;
}

const MAX_PAPER_TRADES = 50_000;

class PaperTradingEngine {
  private paperTrades: PaperTrade[] = [];
  private equityHistory = new Map<string, Array<{ equity: number; timestamp: number }>>();

  /**
   * Execute a signal as a paper trade.
   * Runs through risk engine, simulates fill against orderbook, records trade.
   */
  async executeSignal(signal: Signal, agent: Agent): Promise<PaperTrade | null> {
    const mutex = getAgentMutex(agent.id);
    await mutex.acquire();
    try {
      return await this._executeSignalInner(signal, agent);
    } finally {
      mutex.release();
    }
  }

  private async _executeSignalInner(signal: Signal, agent: Agent): Promise<PaperTrade | null> {
    // Build order request from signal
    const orderRequest: OrderRequest = {
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount: signal.suggestedSize,
      price: signal.suggestedPrice,
      type: 'LIMIT',
    };

    // Run risk checks
    const riskResult = evaluateRisk(agent, orderRequest);
    if (!riskResult.approved) {
      const reason = (riskResult as any).reason;
      logger.info(`Paper trade rejected by risk engine`, {
        agentId: agent.id,
        strategy: signal.strategyName,
        reason,
      });
      return null;
    }

    // Simulate execution against live orderbook
    const executedPrice = await this.simulateExecution(signal);
    const slippage = Math.abs(executedPrice - signal.suggestedPrice);
    const notional = signal.suggestedSize * executedPrice;

    // Create paper trade record
    const paperTrade: PaperTrade = {
      id: `pt_${uuid().replace(/-/g, '').slice(0, 16)}`,
      agentId: agent.id,
      strategyName: signal.strategyName,
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      requestedPrice: signal.suggestedPrice,
      executedPrice,
      amount: signal.suggestedSize,
      notional,
      reasoning: signal.reasoning,
      timestamp: Date.now(),
      slippage,
    };

    this.paperTrades.push(paperTrade);
    if (this.paperTrades.length > MAX_PAPER_TRADES) {
      this.paperTrades = this.paperTrades.slice(-MAX_PAPER_TRADES);
    }

    // Also record in the main trade store (for portfolio tracking)
    const trade: Trade = {
      id: paperTrade.id,
      orderId: `paper_${paperTrade.id}`,
      agentId: agent.id,
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount: signal.suggestedSize,
      price: executedPrice,
      timestamp: Date.now(),
    };
    tradeStore.addTrade(trade);

    // Record an order too
    const order: Order = {
      id: trade.orderId,
      agentId: agent.id,
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount: signal.suggestedSize,
      price: executedPrice,
      type: 'LIMIT',
      status: 'filled',
      filledAmount: signal.suggestedSize,
      clobOrderId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    tradeStore.addOrder(order);

    // Update agent equity
    this.updateAgentEquity(agent, paperTrade);

    // Broadcast for dashboard
    broadcastTrade({
      agentId: agent.id,
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount: signal.suggestedSize,
      price: executedPrice,
    });

    logger.info(`📄 Paper trade executed`, {
      id: paperTrade.id,
      agent: agent.name,
      strategy: signal.strategyName,
      market: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      price: executedPrice.toFixed(4),
      amount: signal.suggestedSize.toFixed(2),
      reasoning: signal.reasoning.slice(0, 100),
    });

    return paperTrade;
  }

  /** Get all paper trades for an agent */
  getAgentTrades(agentId: string, limit = 100): PaperTrade[] {
    return this.paperTrades
      .filter(t => t.agentId === agentId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /** Get all paper trades */
  getAllTrades(limit = 200): PaperTrade[] {
    return this.paperTrades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /** Calculate performance metrics for an agent */
  getPerformance(agent: Agent): AgentPerformance {
    const trades = this.getAgentTrades(agent.id, 1000);
    const positions = tradeStore.getAgentPositions(agent.id);

    // Calculate realized P&L from closed positions and unrealized from open
    let winningTrades = 0;
    let losingTrades = 0;

    // Simple heuristic: compare entry price to current market price
    for (const pos of positions) {
      const market = liveDataService.getMarket(pos.marketId);
      if (market) {
        const priceIdx = pos.outcome === 'YES' ? 0 : 1;
        const currentPrice = market.outcomePrices[priceIdx] ?? pos.avgPrice;
        if (currentPrice > pos.avgPrice) winningTrades++;
        else if (currentPrice < pos.avgPrice) losingTrades++;
      }
    }

    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? winningTrades / Math.max(1, winningTrades + losingTrades) : 0;

    const totalPnl = agent.equity.current - agent.equity.deposited;
    const totalPnlPct = agent.equity.deposited > 0 ? totalPnl / agent.equity.deposited : 0;

    // Sharpe ratio from equity history
    const sharpeRatio = this.calculateSharpe(agent.id);
    const maxDrawdown = this.calculateMaxDrawdown(agent.id);

    return {
      agentId: agent.id,
      agentName: agent.name,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnl,
      totalPnlPct,
      sharpeRatio,
      maxDrawdown,
      currentEquity: agent.equity.current,
      depositedEquity: agent.equity.deposited,
    };
  }

  /** Get leaderboard of all agents ranked by P&L */
  getLeaderboard(): AgentPerformance[] {
    return agentStore
      .list()
      .filter(a => a.status !== 'inactive')
      .map(a => this.getPerformance(a))
      .sort((a, b) => b.totalPnlPct - a.totalPnlPct);
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private async simulateExecution(signal: Signal): Promise<number> {
    // Try to get live orderbook for realistic execution price
    try {
      const orderbook = await liveDataService.getOrderBook(signal.marketId);
      if (orderbook) {
        return this.simulateAgainstOrderbook(signal, orderbook);
      }
    } catch {
      // Fall through to simple simulation
    }

    // Fallback: simulate with small slippage
    const slippageBps = Math.random() * 50; // 0-50 bps random slippage
    const slippage = signal.suggestedPrice * (slippageBps / 10_000);
    const direction = signal.direction === 'BUY' ? 1 : -1;
    return Math.max(0.001, Math.min(0.999, signal.suggestedPrice + slippage * direction));
  }

  private simulateAgainstOrderbook(signal: Signal, orderbook: OrderBook): number {
    const levels = signal.direction === 'BUY' ? orderbook.asks : orderbook.bids;
    if (levels.length === 0) return signal.suggestedPrice;

    // Walk the book to simulate fill
    let remaining = signal.suggestedSize;
    let totalCost = 0;

    for (const level of levels) {
      const fillSize = Math.min(remaining, level.size);
      totalCost += fillSize * level.price;
      remaining -= fillSize;
      if (remaining <= 0) break;
    }

    // If we couldn't fill entirely, use worst level
    if (remaining > 0) {
      const worstPrice = levels[levels.length - 1]?.price ?? signal.suggestedPrice;
      totalCost += remaining * worstPrice;
    }

    return totalCost / signal.suggestedSize;
  }

  private updateAgentEquity(agent: Agent, trade: PaperTrade): void {
    // For paper trading, equity changes based on mark-to-market of positions
    // Simple model: deduct cost basis on buy, credit on sell
    const costBasis = trade.amount * trade.executedPrice;

    if (trade.side === 'BUY') {
      // Buying outcome tokens costs USDC
      const newEquity = agent.equity.current - costBasis;
      agentStore.updateEquity(agent.id, newEquity);
    } else {
      // Selling outcome tokens returns USDC
      const newEquity = agent.equity.current + costBasis;
      agentStore.updateEquity(agent.id, newEquity);
    }

    // Track equity history for Sharpe/drawdown calculations
    const history = this.equityHistory.get(agent.id) ?? [];
    history.push({ equity: agent.equity.current, timestamp: Date.now() });
    if (history.length > 1000) history.shift();
    this.equityHistory.set(agent.id, history);
  }

  private calculateSharpe(agentId: string): number {
    const history = this.equityHistory.get(agentId);
    if (!history || history.length < 3) return 0;

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const ret = (history[i].equity - history[i - 1].equity) / history[i - 1].equity;
      returns.push(ret);
    }

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) return 0;

    // Annualized (assume 5min intervals, ~105120 intervals/year)
    return (mean / stddev) * Math.sqrt(105120);
  }

  private calculateMaxDrawdown(agentId: string): number {
    const history = this.equityHistory.get(agentId);
    if (!history || history.length < 2) return 0;

    let peak = history[0].equity;
    let maxDd = 0;

    for (const entry of history) {
      if (entry.equity > peak) peak = entry.equity;
      const dd = (peak - entry.equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }

    return maxDd;
  }
}

export const paperTrader = new PaperTradingEngine();
