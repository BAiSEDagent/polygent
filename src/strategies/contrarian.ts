import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { liveDataService, LiveMarket } from '../core/live-data';
import { logger } from '../utils/logger';

/**
 * Contrarian Strategy
 *
 * Mean-reversion thesis: markets that move sharply tend to overcorrect.
 * When a market moves >10% in 24h, bet against the move.
 *
 * Confidence modifiers:
 * - Higher volume = more confidence (move is overreaction, not information)
 * - Higher liquidity = easier to enter/exit
 * - Extreme prices (>90% or <10%) = lower confidence (may be correct)
 * - Time to resolution = less mean reversion closer to end
 */

interface PriceMove {
  marketId: string;
  currentPrice: number;
  change24h: number;
  volume: number;
  liquidity: number;
}

export class ContrarianStrategy extends BaseStrategy {
  readonly name = 'contrarian';
  readonly description = 'Fade extreme moves based on mean-reversion thesis';
  readonly version = '1.0.0';

  private readonly MOVE_THRESHOLD = 0.10;     // 10% move triggers analysis
  private readonly EXTREME_PRICE_CAP = 0.92;  // Don't bet against >92% prices
  private readonly EXTREME_PRICE_FLOOR = 0.08; // Don't bet against <8% prices
  private readonly MIN_VOLUME = 10_000;        // $10K minimum volume
  private readonly MIN_LIQUIDITY = 5_000;      // $5K minimum liquidity
  private readonly KELLY_FRACTION = 0.10;      // Very conservative — contrarian is risky
  private recentSignals = new Map<string, number>(); // marketId → timestamp (dedup)

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    if (market.outcomePrices.length < 2) return null;

    const yesPrice = market.outcomePrices[0];

    // Skip extreme prices — they might be correct
    if (yesPrice > this.EXTREME_PRICE_CAP || yesPrice < this.EXTREME_PRICE_FLOOR) {
      return null;
    }

    // Get the live market for 24h change data
    const liveMarket = liveDataService.getMarket(market.id) as LiveMarket | null;
    const change24h = liveMarket?.change24h ?? 0;

    // Need a significant move
    if (Math.abs(change24h) < this.MOVE_THRESHOLD) return null;

    // Volume and liquidity filters
    if (market.volume < this.MIN_VOLUME) return null;
    if (market.liquidity < this.MIN_LIQUIDITY) return null;

    // Dedup: don't signal same market within 30 min
    const lastSignal = this.recentSignals.get(market.id);
    if (lastSignal && Date.now() - lastSignal < 1_800_000) return null;

    // Determine contrarian direction
    const priceWentUp = change24h > 0;

    // If price went up sharply → bet NO (fade the move)
    // If price went down sharply → bet YES (fade the move)
    const outcome = priceWentUp ? 'NO' as const : 'YES' as const;
    const suggestedPrice = outcome === 'YES' ? yesPrice : 1 - yesPrice;

    // Calculate confidence
    const confidence = this.calculateConfidence(market, change24h, liveMarket);
    if (confidence < 0.50) return null;

    // Position sizing — conservative Kelly
    const impliedEdge = Math.abs(change24h) * 0.3; // Assume 30% of move reverts
    const odds = 1 / suggestedPrice;
    const winProb = suggestedPrice + impliedEdge;
    const size = this.kellySize(winProb, odds, context.agent.equity.current, this.KELLY_FRACTION);

    if (size < 1) return null;

    this.recentSignals.set(market.id, Date.now());

    // Cleanup old entries
    if (this.recentSignals.size > 200) {
      const cutoff = Date.now() - 3_600_000;
      for (const [k, v] of this.recentSignals) {
        if (v < cutoff) this.recentSignals.delete(k);
      }
    }

    const direction = priceWentUp ? '📈→📉' : '📉→📈';

    return this.createSignal(market.id, {
      tokenId: market.tokenIds?.[0],
      negRisk: market.negRisk,
      direction: 'BUY',
      outcome,
      confidence,
      suggestedPrice,
      suggestedSize: size,
      reasoning: `${direction} Contrarian: "${market.question.slice(0, 60)}" moved ${(change24h * 100).toFixed(1)}% in 24h. Buying ${outcome} at $${suggestedPrice.toFixed(4)}. Vol: $${(market.volume / 1000).toFixed(0)}K, Liq: $${(market.liquidity / 1000).toFixed(0)}K. Confidence: ${(confidence * 100).toFixed(0)}%.`,
    });
  }

  private calculateConfidence(
    market: Market,
    change24h: number,
    liveMarket: LiveMarket | null
  ): number {
    let confidence = 0.50;

    // Larger moves → more confidence (up to a point)
    const absChange = Math.abs(change24h);
    if (absChange > 0.20) confidence += 0.10;
    else if (absChange > 0.15) confidence += 0.08;
    else confidence += 0.05;

    // High volume → move might be overreaction (good for contrarian)
    if (market.volume > 100_000) confidence += 0.10;
    else if (market.volume > 50_000) confidence += 0.05;

    // High liquidity → easier to trade, more confidence
    if (market.liquidity > 50_000) confidence += 0.05;

    // Price history stability — if price was stable before the move, more likely to revert
    if (liveMarket?.priceHistory && liveMarket.priceHistory.length > 5) {
      const recentPrices = liveMarket.priceHistory.slice(-10).map(p => p.price);
      const stddev = this.stddev(recentPrices);
      if (stddev < 0.05) confidence += 0.05; // Stable market → more likely reversion
    }

    // Time to resolution — less contrarian value close to end
    if (market.endDate) {
      const daysToEnd = (new Date(market.endDate).getTime() - Date.now()) / 86_400_000;
      if (daysToEnd < 1) confidence -= 0.15; // Don't play contrarian near resolution
      else if (daysToEnd < 7) confidence -= 0.05;
    }

    return Math.max(0, Math.min(0.85, confidence));
  }

  private stddev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}
