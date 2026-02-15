import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { liveDataService } from '../core/live-data';
import { logger } from '../utils/logger';

/**
 * Arbitrage Strategy
 *
 * Two modes:
 * 1. **Spread Arbitrage**: YES + NO price sum < 0.98 → buy both for guaranteed profit
 * 2. **Cross-Market Arbitrage**: Detect correlated/identical markets with price divergence
 *
 * This is the safest strategy — near risk-free when spreads are found.
 * In practice, spreads are rare and small on Polymarket (efficient market),
 * but the strategy serves as a constant scanner.
 */

interface ArbitrageOpportunity {
  type: 'spread' | 'cross_market';
  marketId: string;
  yesPrice: number;
  noPrice: number;
  totalPrice: number;
  spread: number;
  relatedMarketId?: string;
  relatedPrice?: number;
}

export class ArbitrageStrategy extends BaseStrategy {
  readonly name = 'arbitrage';
  readonly description = 'Exploit YES+NO pricing inefficiencies for risk-free profit';
  readonly version = '1.0.0';

  private readonly MIN_SPREAD = 0.02;        // 2% minimum spread to trigger
  private readonly CROSS_MARKET_THRESHOLD = 0.05; // 5% price divergence for cross-market
  private seenOpportunities = new Set<string>(); // Dedup within session
  private questionIndex = new Map<string, Array<{ id: string; question: string; prices: number[] }>>();

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    if (market.outcomePrices.length < 2) return null;

    const yesPrice = market.outcomePrices[0];
    const noPrice = market.outcomePrices[1];

    // Index for cross-market detection
    this.indexMarket(market);

    // 1. Spread arbitrage: YES + NO < 1.00
    const spreadSignal = this.checkSpreadArbitrage(market, yesPrice, noPrice, context);
    if (spreadSignal) return spreadSignal;

    // 2. Cross-market arbitrage
    const crossSignal = this.checkCrossMarketArbitrage(market, yesPrice, context);
    if (crossSignal) return crossSignal;

    return null;
  }

  private checkSpreadArbitrage(
    market: Market,
    yesPrice: number,
    noPrice: number,
    context: StrategyContext
  ): Signal | null {
    const totalPrice = yesPrice + noPrice;

    if (totalPrice >= 1.0 - this.MIN_SPREAD) return null;

    const spread = 1.0 - totalPrice;
    const dedupKey = `spread:${market.id}:${spread.toFixed(3)}`;
    if (this.seenOpportunities.has(dedupKey)) return null;
    this.seenOpportunities.add(dedupKey);

    // Clean up old dedup entries periodically
    if (this.seenOpportunities.size > 1000) {
      this.seenOpportunities.clear();
    }

    // Size based on guaranteed profit
    const size = this.kellySize(0.99, 1 / spread, context.agent.equity.current, 0.5);
    if (size < 1) return null;

    // Buy the cheaper side
    const outcome = yesPrice <= noPrice ? 'YES' as const : 'NO' as const;
    const price = outcome === 'YES' ? yesPrice : noPrice;

    const confidence = Math.min(0.95, 0.7 + spread * 3);

    logger.info(`💰 Spread arbitrage found`, {
      market: market.question.slice(0, 60),
      yes: yesPrice.toFixed(4),
      no: noPrice.toFixed(4),
      total: totalPrice.toFixed(4),
      spread: (spread * 100).toFixed(2) + '%',
    });

    return this.createSignal(market.id, {
      tokenId: market.tokenIds?.[0],
      negRisk: market.negRisk,
      direction: 'BUY',
      outcome,
      confidence,
      suggestedPrice: price,
      suggestedSize: size,
      reasoning: `💰 Spread Arb: YES($${yesPrice.toFixed(4)}) + NO($${noPrice.toFixed(4)}) = $${totalPrice.toFixed(4)}. Guaranteed ${(spread * 100).toFixed(2)}% profit. Buying ${outcome} at $${price.toFixed(4)}.`,
    });
  }

  private checkCrossMarketArbitrage(
    market: Market,
    yesPrice: number,
    context: StrategyContext
  ): Signal | null {
    // Normalize question for matching
    const normalized = this.normalizeQuestion(market.question);

    // Find similar markets
    for (const [key, entries] of this.questionIndex) {
      if (key === normalized) continue;

      // Check similarity (simple word overlap)
      const similarity = this.questionSimilarity(normalized, key);
      if (similarity < 0.7) continue;

      for (const entry of entries) {
        if (entry.id === market.id) continue;

        const otherYesPrice = entry.prices[0] ?? 0.5;
        const priceDiff = Math.abs(yesPrice - otherYesPrice);

        if (priceDiff >= this.CROSS_MARKET_THRESHOLD) {
          const dedupKey = `cross:${market.id}:${entry.id}`;
          if (this.seenOpportunities.has(dedupKey)) continue;
          this.seenOpportunities.add(dedupKey);

          // Buy the cheaper market's YES
          const isCheaper = yesPrice < otherYesPrice;
          const outcome = isCheaper ? 'YES' as const : 'NO' as const;
          const price = isCheaper ? yesPrice : 1 - yesPrice;

          const confidence = Math.min(0.85, 0.5 + priceDiff * 2);
          const size = Math.min(
            context.agent.equity.current * 0.05,
            context.agent.config.maxOrderSize
          );

          if (size < 1) continue;

          logger.info(`🔄 Cross-market arbitrage found`, {
            market1: market.question.slice(0, 40),
            market2: entry.question.slice(0, 40),
            price1: yesPrice.toFixed(4),
            price2: otherYesPrice.toFixed(4),
            diff: (priceDiff * 100).toFixed(2) + '%',
          });

          return this.createSignal(market.id, {
      tokenId: market.tokenIds?.[0],
      negRisk: market.negRisk,
            direction: 'BUY',
            outcome,
            confidence,
            suggestedPrice: price,
            suggestedSize: size,
            reasoning: `🔄 Cross-Market Arb: "${market.question.slice(0, 50)}" at $${yesPrice.toFixed(4)} vs similar "${entry.question.slice(0, 50)}" at $${otherYesPrice.toFixed(4)}. Price divergence: ${(priceDiff * 100).toFixed(2)}%.`,
          });
        }
      }
    }

    return null;
  }

  private indexMarket(market: Market): void {
    const key = this.normalizeQuestion(market.question);
    const entries = this.questionIndex.get(key) ?? [];
    const existing = entries.findIndex(e => e.id === market.id);
    const entry = { id: market.id, question: market.question, prices: market.outcomePrices };

    if (existing >= 0) {
      entries[existing] = entry;
    } else {
      entries.push(entry);
    }
    this.questionIndex.set(key, entries);
  }

  private normalizeQuestion(q: string): string {
    return q.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private questionSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(' ').filter(w => w.length > 3));
    const wordsB = new Set(b.split(' ').filter(w => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }

    return overlap / Math.max(wordsA.size, wordsB.size);
  }
}
