import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';

/**
 * Contrarian Strategy (Stub)
 *
 * Fades extreme price moves based on mean-reversion thesis.
 * When a market moves sharply in one direction, bets on reversion.
 *
 * Phase 2 implementation will add:
 * - Historical price tracking for mean calculation
 * - Volume-weighted move detection
 * - Time-decay adjustments (closer to resolution = less mean reversion)
 */
export class ContrarianStrategy extends BaseStrategy {
  readonly name = 'contrarian';
  readonly description = 'Fade extreme moves based on mean-reversion thesis';
  readonly version = '0.1.0';

  private readonly EXTREME_THRESHOLD = 0.85; // Price above this is "extreme YES"
  private readonly LOW_THRESHOLD = 0.15;     // Price below this is "extreme NO"

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    if (market.outcomePrices.length < 2) return null;

    const yesPrice = market.outcomePrices[0];

    // Stub: Would check if this is a sharp recent move, not a stable price
    // For now, just flag extreme prices as potential contrarian plays

    if (yesPrice > this.EXTREME_THRESHOLD) {
      const size = this.kellySize(
        1 - yesPrice + 0.05, // Assume slight edge from mean reversion
        1 / (1 - yesPrice),
        context.agent.equity.current,
        0.1 // Very conservative Kelly fraction for contrarian
      );

      if (size < 1) return null;

      return this.createSignal(market.id, {
        direction: 'BUY',
        outcome: 'NO',
        confidence: 0.55, // Low confidence — contrarian plays are risky
        suggestedPrice: 1 - yesPrice,
        suggestedSize: size,
        reasoning: `Contrarian: YES price at $${yesPrice.toFixed(3)} appears overextended. Mean-reversion opportunity on NO at $${(1 - yesPrice).toFixed(3)}.`,
      });
    }

    if (yesPrice < this.LOW_THRESHOLD) {
      const size = this.kellySize(
        yesPrice + 0.05,
        1 / yesPrice,
        context.agent.equity.current,
        0.1
      );

      if (size < 1) return null;

      return this.createSignal(market.id, {
        direction: 'BUY',
        outcome: 'YES',
        confidence: 0.55,
        suggestedPrice: yesPrice,
        suggestedSize: size,
        reasoning: `Contrarian: YES price at $${yesPrice.toFixed(3)} appears oversold. Mean-reversion opportunity.`,
      });
    }

    return null;
  }
}
