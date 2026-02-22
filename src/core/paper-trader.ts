import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { evaluateRisk } from './risk';
import { liveDataService, OrderBook } from './live-data';
import { agentStore } from '../models/agent';
import { tradeStore } from '../models/trade';
import { broadcastTrade } from './data-feed';
import { Agent, Signal, Trade, Order, OrderRequest } from '../utils/types';
import { getAgentMutex } from '../utils/mutex';
import { insertPaperTrade, loadPaperTrades, PersistedPaperTrade } from './db';

/**
 * Paper Trading Engine
 *
 * Simulates order execution against live orderbook data.
 * Tracks virtual positions, P&L, and trade history per agent.
 * Uses the same risk engine as real trading.
 *
 * Persistence: every paper trade is written to SQLite immediately.
 * On startup, existing trades are loaded to restore leaderboard PnL.
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
  lastTradeAt: number | null;
}

// Hard cap on paper trade size — prevents $500 blowouts on $10k bankroll.
// Agents should build track record with small, consistent bets.
const PAPER_MAX_SIZE = 75;
const MAX_PAPER_TRADES = 50_000;

class PaperTradingEngine {
  private paperTrades: PaperTrade[] = [];
  private equityHistory = new Map<string, Array<{ equity: number; timestamp: number }>>();

  constructor() {
    // Restore paper trades from SQLite on startup.
    // This ensures leaderboard PnL survives VPS restarts.
    this.restoreFromDb();
  }

  /**
   * Load persisted paper trades from SQLite and restore in-memory state.
   * Equity is recalculated from trade history so leaderboard PnL is accurate.
   */
  private restoreFromDb(): void {
    try {
      const rows = loadPaperTrades();
      if (rows.length === 0) return;

      this.paperTrades = rows.map(r => ({ ...r }));
      logger.info(`📀 Restored ${rows.length} paper trades from SQLite`);

      // Recalculate per-agent equity delta from trade history.
      // We apply the delta once agents are registered (agentStore may be empty here).
      // The runner calls restoreAgentEquity() after registration.
    } catch (err) {
      logger.warn('Failed to restore paper trades from SQLite', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Recalculate and restore equity for a registered agent based on its trade history.
   * Called by AgentRunner after each agent is registered.
   */
  restoreAgentEquity(agentId: string, agentName: string): void {
    const agent = agentStore.get(agentId);
    if (!agent) return;

    const agentTrades = this.paperTrades.filter(t => t.agentId === agentId);
    if (agentTrades.length === 0) return;

    // Replay trade history to get correct equity
    let equity = agent.equity.deposited;
    for (const trade of agentTrades.sort((a, b) => a.timestamp - b.timestamp)) {
      const costBasis = trade.amount * trade.executedPrice;
      equity = trade.side === 'BUY' ? equity - costBasis : equity + costBasis;
    }

    agentStore.updateEquity(agentId, equity);
    logger.info(`📊 Restored equity for ${agentName}: $${equity.toFixed(2)} from ${agentTrades.length} trades`);
  }

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
    // Cap trade size — prevents single trades from blowing out the daily loss limit.
    const cappedSize = Math.min(signal.suggestedSize, PAPER_MAX_SIZE);

    // Build order request from signal
    const orderRequest: OrderRequest = {
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount: cappedSize,
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
    const notional = cappedSize * executedPrice;

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
      amount: cappedSize,
      notional,
      reasoning: signal.reasoning,
      timestamp: Date.now(),
      slippage,
    };

    this.paperTrades.push(paperTrade);
    if (this.paperTrades.length > MAX_PAPER_TRADES) {
      this.paperTrades = this.paperTrades.slice(-MAX_PAPER_TRADES);
    }

    // Persist to SQLite immediately — survives restarts.
    const market = liveDataService.getMarket(signal.marketId);
    insertPaperTrade(paperTrade as PersistedPaperTrade, agent.name, market?.question);

    // Also record in the main trade store (for portfolio/risk tracking)
    const trade: Trade = {
      id: paperTrade.id,
      orderId: `paper_${paperTrade.id}`,
      agentId: agent.id,
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount: cappedSize,
      price: executedPrice,
      source: 'paper',
      timestamp: Date.now(),
    };
    tradeStore.addTrade(trade);

    // Record a synthetic order for position tracking
    const order: Order = {
      id: trade.orderId,
      agentId: agent.id,
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount: cappedSize,
      price: executedPrice,
      type: 'LIMIT',
      status: 'filled',
      filledAmount: cappedSize,
      clobOrderId: null,
      source: 'paper',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    tradeStore.addOrder(order);

    // Update agent equity
    this.updateAgentEquity(agent, paperTrade);

    // Broadcast for dashboard WebSocket feed
    broadcastTrade({
      agentId: agent.id,
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount: cappedSize,
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
      amount: cappedSize.toFixed(2),
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

    // Calculate win/loss from open positions vs current market price
    let winningTrades = 0;
    let losingTrades = 0;

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

    const sharpeRatio = this.calculateSharpe(agent.id);
    const maxDrawdown = this.calculateMaxDrawdown(agent.id);

    // Last trade timestamp — proof of life
    const lastTradeAt = trades.length > 0 ? trades[0].timestamp : null;

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
      lastTradeAt,
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
    try {
      const orderbook = await liveDataService.getOrderBook(signal.marketId);
      if (orderbook) {
        return this.simulateAgainstOrderbook(signal, orderbook);
      }
    } catch {
      // Fall through to simple simulation
    }

    // Fallback: simulate with small slippage
    const slippageBps = Math.random() * 50; // 0-50 bps
    const slippage = signal.suggestedPrice * (slippageBps / 10_000);
    const direction = signal.direction === 'BUY' ? 1 : -1;
    return Math.max(0.001, Math.min(0.999, signal.suggestedPrice + slippage * direction));
  }

  private simulateAgainstOrderbook(signal: Signal, orderbook: OrderBook): number {
    const levels = signal.direction === 'BUY' ? orderbook.asks : orderbook.bids;
    if (levels.length === 0) return signal.suggestedPrice;

    let remaining = signal.suggestedSize;
    let totalCost = 0;

    for (const level of levels) {
      const fillSize = Math.min(remaining, level.size);
      totalCost += fillSize * level.price;
      remaining -= fillSize;
      if (remaining <= 0) break;
    }

    if (remaining > 0) {
      const worstPrice = levels[levels.length - 1]?.price ?? signal.suggestedPrice;
      totalCost += remaining * worstPrice;
    }

    return totalCost / signal.suggestedSize;
  }

  private updateAgentEquity(agent: Agent, trade: PaperTrade): void {
    const costBasis = trade.amount * trade.executedPrice;

    if (trade.side === 'BUY') {
      agentStore.updateEquity(agent.id, agent.equity.current - costBasis);
    } else {
      agentStore.updateEquity(agent.id, agent.equity.current + costBasis);
    }

    // Track equity curve for Sharpe/drawdown
    const history = this.equityHistory.get(agent.id) ?? [];
    history.push({ equity: agent.equity.current, timestamp: Date.now() });
    if (history.length > 1000) history.shift();
    this.equityHistory.set(agent.id, history);
  }

  private calculateSharpe(agentId: string): number {
    const history = this.equityHistory.get(agentId);
    if (!history || history.length < 3) return 0;

    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const ret = (history[i].equity - history[i - 1].equity) / history[i - 1].equity;
      returns.push(ret);
    }

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) return 0;
    return (mean / stddev) * Math.sqrt(105120); // Annualized
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
