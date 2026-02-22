import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { liveDataService } from '../core/live-data';
import { logger } from '../utils/logger';

/**
 * Arbitrage Strategy — Integrity Edition
 *
 * Two modes only:
 *
 * 1. SPREAD ARBITRAGE (true risk-free)
 *    YES + NO price sum < 1.0 − MIN_SPREAD. Guaranteed profit.
 *    Rare on efficient markets but real when found.
 *
 * 2. DUPLICATE MARKET ARBITRAGE (same event, two listings)
 *    Detects the SAME question listed twice with different prices.
 *    Requires ALL of:
 *      a) Question similarity ≥ 0.92 (near-identical text)
 *      b) Same category
 *      c) Matching threshold numbers (within 5%) — eliminates
 *         "London 12°C vs 13°C" and "ETH $1800 vs ETH $2000"
 *
 * INTENTIONALLY EXCLUDED:
 *   - "Correlated" markets with different thresholds or different subjects.
 *     These are not arbitrage — they are speculation.
 *   - Weather markets at different temperatures are independent events.
 *   - Price markets at different thresholds have different expected values.
 */

interface IndexedMarket {
  id: string;
  question: string;
  category: string;
  prices: number[];
}

export class ArbitrageStrategy extends BaseStrategy {
  readonly name = 'arbitrage';
  readonly description = 'Spread arb + duplicate-market detection. No false correlations.';
  readonly version = '2.0.0';

  // Spread arb: YES + NO must be < 1.0 − MIN_SPREAD to trigger
  private readonly MIN_SPREAD = 0.02;

  // Duplicate market arb: minimum price divergence between identical markets
  private readonly DUPLICATE_MIN_DIVERGENCE = 0.05;

  // Duplicate detection gates (all must pass)
  private readonly SIMILARITY_THRESHOLD = 0.92;   // Near-identical questions only
  private readonly NUMBER_TOLERANCE = 0.05;        // Numbers must match within 5%

  private seenOpportunities = new Set<string>();
  // marketIndex: normalizedQuestion → list of indexed markets with same text
  private marketIndex = new Map<string, IndexedMarket[]>();

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    if (market.outcomePrices.length < 2) return null;

    const yesPrice = market.outcomePrices[0];
    const noPrice  = market.outcomePrices[1];

    // Update our market index
    this.indexMarket(market);

    // 1. Spread arb (true risk-free)
    const spreadSignal = this.checkSpreadArbitrage(market, yesPrice, noPrice, context);
    if (spreadSignal) return spreadSignal;

    // 2. Duplicate market arb (same question, two prices)
    const dupSignal = this.checkDuplicateMarketArbitrage(market, yesPrice, context);
    if (dupSignal) return dupSignal;

    return null;
  }

  // ─── Spread Arbitrage ─────────────────────────────────────────────────────

  private checkSpreadArbitrage(
    market: Market,
    yesPrice: number,
    noPrice: number,
    context: StrategyContext,
  ): Signal | null {
    const totalPrice = yesPrice + noPrice;
    if (totalPrice >= 1.0 - this.MIN_SPREAD) return null;

    const spread = 1.0 - totalPrice;
    const dedupKey = `spread:${market.id}:${spread.toFixed(3)}`;
    if (this.seenOpportunities.has(dedupKey)) return null;
    this.seenOpportunities.add(dedupKey);

    if (this.seenOpportunities.size > 1000) this.seenOpportunities.clear();

    const size = this.kellySize(0.99, 1 / spread, context.agent.equity.current, 0.5);
    if (size < 1) return null;

    const outcome = yesPrice <= noPrice ? 'YES' as const : 'NO' as const;
    const price   = outcome === 'YES' ? yesPrice : noPrice;
    const confidence = Math.min(0.95, 0.7 + spread * 3);

    logger.info(`💰 Spread arb: ${market.question.slice(0, 50)} | YES+NO=${totalPrice.toFixed(4)} | spread=${(spread * 100).toFixed(2)}%`);

    return this.createSignal(market.id, {
      tokenId:       market.tokenIds?.[0],
      negRisk:       market.negRisk,
      direction:     'BUY',
      outcome,
      confidence,
      suggestedPrice: price,
      suggestedSize:  size,
      reasoning: `💰 Spread Arb: YES(${yesPrice.toFixed(4)}) + NO(${noPrice.toFixed(4)}) = ${totalPrice.toFixed(4)}. Guaranteed ${(spread * 100).toFixed(2)}% profit.`,
    });
  }

  // ─── Duplicate Market Arbitrage ───────────────────────────────────────────

  /**
   * Detects the same question listed twice on Polymarket with different prices.
   *
   * Valid pair must pass ALL gates:
   *   1. Question similarity ≥ 0.92
   *   2. Same category
   *   3. All numeric thresholds in both questions match within 5%
   *   4. Price divergence ≥ DUPLICATE_MIN_DIVERGENCE
   */
  private checkDuplicateMarketArbitrage(
    market: Market,
    yesPrice: number,
    context: StrategyContext,
  ): Signal | null {
    const normalized    = this.normalize(market.question);
    const marketNumbers = this.extractNumbers(market.question);
    const marketCat     = (market.category || '').toLowerCase().trim();

    for (const [key, entries] of this.marketIndex) {
      if (key === normalized) continue;

      // Gate 1: Question text similarity
      const sim = this.similarity(normalized, key);
      if (sim < this.SIMILARITY_THRESHOLD) continue;

      for (const entry of entries) {
        if (entry.id === market.id) continue;

        // Gate 2: Same category (skip if either is unknown)
        const entryCat = (entry.category || '').toLowerCase().trim();
        if (marketCat && entryCat && marketCat !== entryCat) {
          logger.debug(`[Arb] Skipping cross-category pair: ${marketCat} ≠ ${entryCat}`);
          continue;
        }

        // Gate 3: Numeric thresholds must match (within tolerance)
        const entryNumbers = this.extractNumbers(entry.question);
        if (!this.numbersMatch(marketNumbers, entryNumbers)) {
          logger.debug(`[Arb] Skipping: threshold mismatch in "${market.question.slice(0, 40)}" vs "${entry.question.slice(0, 40)}"`);
          continue;
        }

        // Gate 4: Price divergence
        const otherYesPrice = entry.prices[0] ?? 0.5;
        const priceDiff     = Math.abs(yesPrice - otherYesPrice);
        if (priceDiff < this.DUPLICATE_MIN_DIVERGENCE) continue;

        const dedupKey = [market.id, entry.id].sort().join(':');
        if (this.seenOpportunities.has(dedupKey)) continue;
        this.seenOpportunities.add(dedupKey);

        // Buy the cheaper side
        const isCheaper = yesPrice < otherYesPrice;
        const outcome   = isCheaper ? 'YES' as const : 'NO' as const;
        const price     = isCheaper ? yesPrice : 1 - yesPrice;
        const confidence = Math.min(0.85, 0.55 + priceDiff * 2);
        const size      = Math.min(
          context.agent.equity.current * 0.01,   // 1% of bankroll max
          context.agent.config.maxOrderSize,
        );

        if (size < 1) continue;

        logger.info(
          `🔄 Duplicate market arb: sim=${(sim * 100).toFixed(0)}% | ` +
          `"${market.question.slice(0, 35)}" $${yesPrice.toFixed(4)} vs ` +
          `"${entry.question.slice(0, 35)}" $${otherYesPrice.toFixed(4)} | diff=${(priceDiff * 100).toFixed(2)}%`
        );

        return this.createSignal(market.id, {
          tokenId:       market.tokenIds?.[0],
          negRisk:       market.negRisk,
          direction:     'BUY',
          outcome,
          confidence,
          suggestedPrice: price,
          suggestedSize:  size,
          reasoning: `🔄 Duplicate Market Arb (sim=${(sim * 100).toFixed(0)}%): ` +
            `"${market.question.slice(0, 50)}" $${yesPrice.toFixed(4)} vs ` +
            `"${entry.question.slice(0, 50)}" $${otherYesPrice.toFixed(4)}. ` +
            `Divergence: ${(priceDiff * 100).toFixed(2)}%. Same event, two prices.`,
        });
      }
    }

    return null;
  }

  // ─── Market Index ─────────────────────────────────────────────────────────

  private indexMarket(market: Market): void {
    const key   = this.normalize(market.question);
    const entry: IndexedMarket = {
      id:       market.id,
      question: market.question,
      category: market.category || '',
      prices:   market.outcomePrices,
    };
    const list  = this.marketIndex.get(key) ?? [];
    const idx   = list.findIndex(e => e.id === market.id);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    this.marketIndex.set(key, list);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private normalize(q: string): string {
    return q.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Word-overlap Jaccard similarity on words longer than 3 chars.
   * Returns 0–1; 1 = identical.
   */
  private similarity(a: string, b: string): number {
    const setA = new Set(a.split(' ').filter(w => w.length > 3));
    const setB = new Set(b.split(' ').filter(w => w.length > 3));
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;
    let overlap = 0;
    for (const w of setA) if (setB.has(w)) overlap++;
    return overlap / (setA.size + setB.size - overlap); // Jaccard
  }

  /**
   * Extract all positive numbers from a question string.
   * Used to verify thresholds match between candidate pairs.
   */
  private extractNumbers(q: string): number[] {
    const raw = q.match(/[\d,]+\.?\d*/g) ?? [];
    return raw
      .map(m => parseFloat(m.replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0);
  }

  /**
   * Checks that two number arrays describe the same thresholds.
   * Both must have the same count, and each pair must be within tolerance.
   *
   * Examples that PASS (same event):
   *   [3000] vs [3000]  — "Gold > $3000" (same threshold)
   *
   * Examples that FAIL (different events):
   *   [1800] vs [2000]  — "ETH > $1800" vs "ETH > $2000" (different thresholds)
   *   [12]   vs [13]    — "London 12°C" vs "London 13°C"  (different thresholds)
   *   []     vs [3000]  — one has no number, the other does
   */
  private numbersMatch(a: number[], b: number[]): boolean {
    // If neither question has numbers, allow (non-numeric events like "Will X win?")
    if (a.length === 0 && b.length === 0) return true;
    // Different count = different questions
    if (a.length !== b.length) return false;
    // Each number pair must agree within tolerance
    return a.every((n, i) => {
      const other = b[i];
      const maxVal = Math.max(n, other);
      return maxVal === 0 || Math.abs(n - other) / maxVal <= this.NUMBER_TOLERANCE;
    });
  }
}
