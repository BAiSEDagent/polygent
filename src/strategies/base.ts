import { Market, Signal, StrategyContext, Order, Agent, OrderRequest } from '../utils/types';

/**
 * Base strategy interface.
 *
 * Strategies analyze market data and produce trading signals.
 * The platform executes signals through the standard order flow
 * (risk checks → CLOB submission).
 */
export interface Strategy {
  /** Unique strategy identifier */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Strategy version */
  readonly version: string;

  /**
   * Analyze a market and optionally produce a trading signal.
   * Return null if no actionable signal is detected.
   */
  analyze(market: Market, context: StrategyContext): Promise<Signal | null>;

  /**
   * Convert a signal into an order request.
   * Applies position sizing, price adjustments, etc.
   */
  toOrder(signal: Signal, context: StrategyContext): OrderRequest;

  /**
   * Called when the strategy is initialized.
   * Use for setup, loading state, etc.
   */
  init?(): Promise<void>;

  /**
   * Called when the strategy is shut down.
   */
  dispose?(): Promise<void>;
}

/**
 * Abstract base class with common strategy utilities.
 */
export abstract class BaseStrategy implements Strategy {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly version: string;

  abstract analyze(market: Market, context: StrategyContext): Promise<Signal | null>;

  toOrder(signal: Signal, context: StrategyContext): OrderRequest {
    // Default position sizing: use suggested size, capped by agent config
    const maxOrderSize = context.agent.config.maxOrderSize;
    const amount = Math.min(signal.suggestedSize, maxOrderSize);

    return {
      marketId: signal.marketId,
      side: signal.direction,
      outcome: signal.outcome,
      amount,
      price: signal.suggestedPrice,
      type: 'LIMIT',
    };
  }

  /** Helper: create a signal object */
  protected createSignal(
    marketId: string,
    params: {
      direction: 'BUY' | 'SELL';
      outcome: 'YES' | 'NO';
      confidence: number;
      suggestedPrice: number;
      suggestedSize: number;
      reasoning: string;
      tokenId?: string;
      negRisk?: boolean;
    }
  ): Signal {
    return {
      strategyName: this.name,
      marketId,
      direction: params.direction,
      outcome: params.outcome,
      confidence: Math.max(0, Math.min(1, params.confidence)),
      suggestedPrice: params.suggestedPrice,
      suggestedSize: params.suggestedSize,
      reasoning: params.reasoning,
      timestamp: Date.now(),
      // Live trading fields
      tokenId: params.tokenId,
      price: params.suggestedPrice,
      amount: params.suggestedSize,
      negRisk: params.negRisk,
    };
  }

  /** Helper: calculate Kelly criterion position size */
  protected kellySize(
    winProb: number,
    odds: number,
    bankroll: number,
    fraction = 0.25 // Quarter Kelly for safety
  ): number {
    const edge = winProb * odds - (1 - winProb);
    if (edge <= 0) return 0;
    const kelly = edge / odds;
    return bankroll * kelly * fraction;
  }
}
