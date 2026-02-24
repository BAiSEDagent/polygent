import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { liveDataService, LiveMarket } from './live-data';
import { paperTrader, PaperTrade } from './paper-trader';
import { initLiveTrader, getLiveTrader } from './live-trader';
import { agentStore } from '../models/agent';
import { tradeStore } from '../models/trade';
import { checkCircuitBreaker } from './risk';
import { Strategy } from '../strategies/base';
import { Agent, Signal, StrategyContext, Portfolio } from '../utils/types';
import { config } from '../config';

/**
 * Agent Runner — orchestrates strategy agents on a configurable interval.
 *
 * Each registered agent runs its strategy against live market data,
 * producing signals that flow through risk engine → paper trader.
 */

interface RegisteredAgent {
  agent: Agent;
  strategy: Strategy;
  intervalMs: number;
  lastRun: number;
  totalSignals: number;
  totalTrades: number;
  errors: number;
}

export interface AgentActivity {
  agentId: string;
  agentName: string;
  strategyName: string;
  type: 'signal' | 'trade' | 'error' | 'circuit_break' | 'no_signal';
  data?: any;
  timestamp: number;
}

class AgentRunner extends EventEmitter {
  private registeredAgents = new Map<string, RegisteredAgent>();
  private runInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private activityLog: AgentActivity[] = [];
  private readonly MAX_ACTIVITY_LOG = 500;
  private readonly DEFAULT_INTERVAL_MS = 5 * 60_000; // 5 minutes
  private readonly TICK_INTERVAL_MS = 30_000; // Check every 30s
  private lastPruneTime = 0;
  private readonly PRUNE_INTERVAL_MS = 5 * 60_000; // 5 minutes

  /** Register a strategy agent */
  registerAgent(
    name: string,
    strategy: Strategy,
    options?: { deposit?: number; intervalMs?: number }
  ): Agent {
    // Production guard: refuse to use dummy private keys
    const dummyPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const { config } = require('../config');
    
    if (config.NODE_ENV === 'production') {
      throw new Error(
        'Cannot create internal agents with dummy private keys in production mode. ' +
        'Internal agents should not be used with real money trading.'
      );
    }
    
    // SECURITY: Validate deposit amount
    const deposit = options?.deposit ?? 10_000;
    if (deposit <= 0 || !isFinite(deposit) || isNaN(deposit)) {
      throw new Error(`Invalid deposit for agent "${name}": ${deposit}. Must be positive and finite.`);
    }
    if (deposit > 10_000_000) {
      throw new Error(`Invalid deposit for agent "${name}": $${deposit.toLocaleString()}. Exceeds maximum $10M.`);
    }
    
    const agent = agentStore.create({
      id: `agent_${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
      name,
      apiKeyHash: `internal_${name}`,
      privateKey: dummyPrivateKey, // Paper only - production guard above prevents real use
      walletAddress: '0x0000000000000000000000000000000000000000',
      deposit, // Validated above
      configOverrides: {
        maxOrderSize: 100, // Capped — paper-trader enforces $75 hard limit per trade
        maxPositionPct: 0.15,
        maxDrawdownPct: 0.25,
        dailyLossLimitPct: 0.10,
        maxExposure: 0.8,
        minDiversification: 2,
      },
    });

    this.registeredAgents.set(agent.id, {
      agent,
      strategy,
      intervalMs: options?.intervalMs ?? this.DEFAULT_INTERVAL_MS,
      lastRun: 0,
      totalSignals: 0,
      totalTrades: 0,
      errors: 0,
    });

    logger.info(`🤖 Registered agent: ${name} (${strategy.name} v${strategy.version})`, {
      agentId: agent.id,
      deposit: agent.equity.deposited,
      interval: `${(options?.intervalMs ?? this.DEFAULT_INTERVAL_MS) / 1000}s`,
    });

    // Restore equity from persisted paper trade history (survives restarts)
    paperTrader.restoreAgentEquity(agent.id, name);

    return agent;
  }

  /** Start the runner loop */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Initialize all strategies
    for (const [, reg] of this.registeredAgents) {
      if (reg.strategy.init) {
        try {
          await reg.strategy.init();
        } catch (error) {
          logger.error(`Failed to init strategy ${reg.strategy.name}`, {
            error: (error as Error).message,
          });
        }
      }
    }

    // Start tick loop
    this.runInterval = setInterval(() => this.tick(), this.TICK_INTERVAL_MS);

    // Run immediately
    await this.tick();

    logger.info(`🏃 Agent Runner started with ${this.registeredAgents.size} agents`);
  }

  /** Stop the runner */
  async stop(): Promise<void> {
    this.running = false;

    if (this.runInterval) {
      clearInterval(this.runInterval);
      this.runInterval = null;
    }

    // Dispose strategies
    for (const [, reg] of this.registeredAgents) {
      if (reg.strategy.dispose) {
        try {
          await reg.strategy.dispose();
        } catch {
          // Ignore disposal errors
        }
      }
    }

    logger.info('Agent Runner stopped');
  }

  /** Get registered agents with stats */
  getAgents(): Array<{
    agentId: string;
    name: string;
    strategy: string;
    status: string;
    equity: number;
    deposited: number;
    pnl: number;
    totalSignals: number;
    totalTrades: number;
    errors: number;
    lastRun: number;
  }> {
    return Array.from(this.registeredAgents.values()).map(reg => {
      const agent = agentStore.get(reg.agent.id) ?? reg.agent;
      return {
        agentId: agent.id,
        name: agent.name,
        strategy: reg.strategy.name,
        status: agent.status,
        equity: agent.equity.current,
        deposited: agent.equity.deposited,
        pnl: agent.equity.current - agent.equity.deposited,
        totalSignals: reg.totalSignals,
        totalTrades: reg.totalTrades,
        errors: reg.errors,
        lastRun: reg.lastRun,
      };
    });
  }

  /** Get recent activity log */
  getActivity(limit = 50): AgentActivity[] {
    return this.activityLog.slice(-limit);
  }

  /** Get a registered agent by ID */
  getRegisteredAgent(agentId: string): RegisteredAgent | undefined {
    return this.registeredAgents.get(agentId);
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    if (!this.running) return;

    const now = Date.now();

    // Periodic pruning of stale data to prevent memory leaks
    if (now - this.lastPruneTime > this.PRUNE_INTERVAL_MS) {
      this.lastPruneTime = now;
      tradeStore.pruneStaleData();
    }

    const markets = liveDataService.getTopMarkets(30);

    if (markets.length === 0) {
      logger.debug('No markets available, skipping tick');
      return;
    }

    for (const [agentId, reg] of this.registeredAgents) {
      // Check if it's time to run this agent
      if (now - reg.lastRun < reg.intervalMs) continue;
      reg.lastRun = now;

      const agent = agentStore.get(agentId);
      if (!agent) continue;

      // Check circuit breaker
      if (checkCircuitBreaker(agent)) {
        agentStore.setCircuitBreak(agentId);
        this.logActivity(agent, reg.strategy.name, 'circuit_break', {
          drawdown: ((agent.equity.peakEquity - agent.equity.current) / agent.equity.peakEquity * 100).toFixed(1) + '%',
        });
        continue;
      }

      if (agent.status !== 'active') continue;

      // Run strategy against each market
      await this.runStrategyOnMarkets(reg, agent, markets);
    }
  }

  private async runStrategyOnMarkets(
    reg: RegisteredAgent,
    agent: Agent,
    markets: LiveMarket[]
  ): Promise<void> {
    const context = this.buildContext(agent);

    for (const market of markets) {
      try {
        const signal = await reg.strategy.analyze(market, context);

        if (!signal) continue;

        reg.totalSignals++;
        this.logActivity(agent, reg.strategy.name, 'signal', {
          marketId: signal.marketId,
          direction: signal.direction,
          outcome: signal.outcome,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
        });

        // Only execute high-confidence signals
        if (signal.confidence < 0.5) continue;

        // Route through paper or live trader based on TRADING_MODE
        if (config.TRADING_MODE === 'live') {
          const liveTrader = getLiveTrader();
          if (liveTrader) {
            // Map signal to live order — use first token for the outcome
            const tokenId = signal.tokenId; // strategies must provide this
            if (tokenId) {
              const result = await liveTrader.placeOrder({
                tokenId,
                side: signal.direction === 'BUY' ? 'BUY' : 'SELL',
                price: signal.price ?? 0.5,
                size: Math.min(signal.amount ?? 10, config.MAX_ORDER_SIZE / (signal.price ?? 0.5)),
                negRisk: signal.negRisk ?? false,
              });
              if (result.success) {
                reg.totalTrades++;
                this.logActivity(agent, reg.strategy.name, 'trade', {
                  orderId: result.orderId,
                  marketId: signal.marketId,
                  side: signal.direction,
                  outcome: signal.outcome,
                  price: signal.price,
                  amount: result.size,
                  reasoning: signal.reasoning,
                  mode: 'LIVE',
                });
              } else {
                this.logActivity(agent, reg.strategy.name, 'error', {
                  error: result.error,
                  market: signal.marketId,
                  mode: 'LIVE',
                });
              }
            }
          }
        } else {
          // Paper trading (default)
          const trade = await paperTrader.executeSignal(signal, agent);
          if (trade) {
            reg.totalTrades++;
            this.logActivity(agent, reg.strategy.name, 'trade', {
              tradeId: trade.id,
              marketId: trade.marketId,
              side: trade.side,
              outcome: trade.outcome,
              price: trade.executedPrice,
              amount: trade.amount,
              reasoning: trade.reasoning,
              mode: 'PAPER',
            });
          }
        }
      } catch (error) {
        reg.errors++;
        this.logActivity(agent, reg.strategy.name, 'error', {
          error: (error as Error).message,
          market: market.id,
        });
        logger.debug(`Strategy error for ${reg.strategy.name} on ${market.id}`, {
          error: (error as Error).message,
        });
      }
    }
  }

  private buildContext(agent: Agent): StrategyContext {
    const positions = tradeStore.getAgentPositions(agent.id);
    const recentTrades = tradeStore.getAgentTrades(agent.id, 20);
    const exposure = tradeStore.getAgentExposure(agent.id);

    return {
      agent,
      portfolio: {
        agentId: agent.id,
        positions,
        totalEquity: agent.equity.current,
        totalPnl: agent.equity.current - agent.equity.deposited,
        totalPnlPct: agent.equity.deposited > 0
          ? (agent.equity.current - agent.equity.deposited) / agent.equity.deposited
          : 0,
        openExposure: exposure,
      },
      recentTrades,
    };
  }

  private logActivity(
    agent: Agent,
    strategyName: string,
    type: AgentActivity['type'],
    data?: any
  ): void {
    const activity: AgentActivity = {
      agentId: agent.id,
      agentName: agent.name,
      strategyName,
      type,
      data,
      timestamp: Date.now(),
    };

    this.activityLog.push(activity);
    if (this.activityLog.length > this.MAX_ACTIVITY_LOG) {
      this.activityLog = this.activityLog.slice(-this.MAX_ACTIVITY_LOG);
    }

    this.emit('activity', activity);
  }
}

export const agentRunner = new AgentRunner();
