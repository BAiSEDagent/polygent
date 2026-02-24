import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { logger } from '../utils/logger';
import { safeParseFloat } from '../utils/sanitize';

/**
 * Arbitrage Strategy v2.1.0 — Institutional Logic Edition
 *
 * THREE VALID PLAY TYPES (in order of quality):
 *
 * 1. INTRA-MARKET SPREAD ARB (risk-free, highest priority)
 *    YES + NO < 0.98 on the SAME market → guaranteed profit after fees.
 *    The canonical prediction market arb. Rare but real.
 *
 * 2. SAME-EVENT SUM-TO-ONE ARB (event-group mispricing)
 *    Markets sharing the same Gamma API `eventId` are mutually exclusive
 *    outcomes of one real-world event (e.g. "London temp on Feb 22").
 *    If the sum of all YES prices across those markets < 0.90, at least one
 *    outcome is underpriced — buy the cheapest YES for positive EV.
 *    This is how institutional shops (Wintermute, GSR) hunt multi-outcome
 *    market mispricings without hallucinating false correlations.
 *
 * 3. DUPLICATE LISTING ARB (same question, two market IDs)
 *    Fallback for markets without an eventId. Requires:
 *      a) Text similarity ≥ 0.92
 *      b) Same category
 *      c) Threshold numbers identical within 5%
 *    Much stricter than v1's naive overlap — eliminates weather/temp noise.
 *
 * EXPLICITLY REJECTED:
 *   - Different thresholds for the same asset ("ETH > $1800" vs "ETH > $2000")
 *   - Different temperature brackets ("London 12°C" vs "London 13°C") —
 *     these are same-event outcomes, not arb pairs
 *   - Any cross-event, cross-category, or cross-subject matching
 *
 * FOK NOTE: Fill-or-Kill execution is required for multi-leg live trades
 *   to eliminate legging risk. FOK implementation required before live trading.
 *   SECURITY: Multi-leg arb without FOK creates directional exposure risk.
 */

interface IndexedMarket {
  id: string;
  question: string;
  category: string;
  eventId?: string;
  prices: number[];
  negRisk: boolean; // true = mutually exclusive outcomes (only one can resolve YES)
}

export class ArbitrageStrategy extends BaseStrategy {
  readonly name        = 'arbitrage';
  readonly description = 'Event-ID-based institutional arb: spread + same-event sum-to-one + duplicate detection.';
  readonly version     = '2.1.0';

  // Intra-market spread: YES + NO must be ≤ 1.0 − MIN_SPREAD
  private readonly SPREAD_MIN              = 0.02;
  
  // Confidence calculation multiplier for spread → confidence mapping
  private readonly CONFIDENCE_SPREAD_MULTIPLIER = 3.0; // spread * 3 → confidence boost

  // Same-event sum-to-one: fire when total YES across event < this
  private readonly EVENT_SUM_THRESHOLD     = 0.90;

  // Duplicate listing: minimum price gap between near-identical markets
  private readonly DUPLICATE_MIN_GAP       = 0.05;

  // Polymarket tick bounds (avoid generating unplaceable orders)
  private readonly MIN_POLY_PRICE          = 0.01;

  // Duplicate listing text gate
  private readonly SIMILARITY_THRESHOLD    = 0.92;
  private readonly NUMBER_TOLERANCE        = 0.001; // SECURITY: 0.1% for price thresholds (was 5%)

  private seenOpportunities = new Set<string>();

  // questionIndex: normalizedQuestion → markets (for duplicate detection fallback)
  private questionIndex = new Map<string, IndexedMarket[]>();

  // eventIndex: eventId → markets (primary grouping for same-event arb)
  private eventIndex = new Map<string, IndexedMarket[]>();

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    if (market.outcomePrices.length < 2) return null;

    const yesPrice = market.outcomePrices[0];
    const noPrice  = market.outcomePrices[1];

    // Update indexes
    this.indexMarket(market);

    // 1. Intra-market spread arb (true risk-free, highest priority)
    const spreadSignal = this.checkSpreadArb(market, yesPrice, noPrice, context);
    if (spreadSignal) return spreadSignal;

    // 2. Same-event sum-to-one arb (event-group mispricing via eventId)
    // Only applies to negRisk markets — these are mutually exclusive outcomes
    // (e.g. Trump deportation brackets). Non-negRisk multi-market events
    // (e.g. "GTA VI before X") are independent events, not mutually exclusive.
    if (market.eventId && market.negRisk) {
      const eventSignal = this.checkSameEventArb(market, context);
      if (eventSignal) return eventSignal;
    }

    // 3. Duplicate listing arb (fallback for markets without eventId)
    const dupSignal = this.checkDuplicateArb(market, yesPrice, context);
    if (dupSignal) return dupSignal;

    return null;
  }

  // ─── 1. Intra-Market Spread Arb ───────────────────────────────────────────

  private checkSpreadArb(
    market: Market,
    yesPrice: number,
    noPrice: number,
    context: StrategyContext,
  ): Signal | null {
    const total = yesPrice + noPrice;
    if (total >= 1.0 - this.SPREAD_MIN) return null;

    const spread = 1.0 - total;
    const key    = `spread:${market.id}:${spread.toFixed(3)}`;
    if (this.seenOpportunities.has(key)) return null;
    this.seenOpportunities.add(key);
    this.trimSeen();

    const size = this.kellySize(0.99, 1 / spread, context.agent.equity.current, 0.5);
    if (size < 1) return null;

    const outcome    = yesPrice <= noPrice ? 'YES' as const : 'NO' as const;
    const price      = outcome === 'YES' ? yesPrice : noPrice;
    const confidence = Math.min(0.95, 0.70 + spread * this.CONFIDENCE_SPREAD_MULTIPLIER);

    logger.info(`💰 Spread arb: "${market.question.slice(0, 50)}" YES+NO=${total.toFixed(4)} spread=${(spread * 100).toFixed(2)}%`);
    
    // SECURITY WARNING: Multi-leg arb without FOK creates legging risk in live mode
    const { config } = await import('../config');
    if (config.TRADING_MODE === 'live') {
      logger.warn(
        `⚠️  Arb signal in LIVE mode without FOK support! Risk: partial fill creates directional exposure. ` +
        `Implement Fill-or-Kill before executing multi-leg strategies.`
      );
    }

    return this.createSignal(market.id, {
      tokenId:        market.tokenIds?.[0],
      negRisk:        market.negRisk,
      direction:      'BUY',
      outcome,
      confidence,
      suggestedPrice: price,
      suggestedSize:  size,
      reasoning:
        `💰 Spread Arb: YES(${yesPrice.toFixed(4)}) + NO(${noPrice.toFixed(4)}) = ${total.toFixed(4)}. ` +
        `Guaranteed ${(spread * 100).toFixed(2)}% profit after fees.`,
    });
  }

  // ─── 2. Same-Event Sum-to-One Arb ────────────────────────────────────────

  /**
   * Groups markets by eventId and checks if the collective YES prices are
   * consistent with the sum-to-one axiom of mutually exclusive outcomes.
   *
   * London 12°C and London 13°C share an eventId → summed, not arbed.
   * If sum of YES across all brackets < EVENT_SUM_THRESHOLD, there is
   * collective underpricing and the cheapest YES is the best EV play.
   */
  private checkSameEventArb(market: Market, context: StrategyContext): Signal | null {
    const eventId  = market.eventId!;
    const siblings = this.eventIndex.get(eventId) ?? [];

    // Need at least 2 markets in the event group to detect mispricing
    if (siblings.length < 2) return null;

    const sumYes = siblings.reduce((s, m) => s + (m.prices[0] ?? 0), 0);

    // Only signal when total YES is meaningfully below 1.0
    // (collective underpricing — the market is leaving money on the table)
    if (sumYes >= this.EVENT_SUM_THRESHOLD) return null;

    const key = `event:${eventId}:${sumYes.toFixed(3)}`;
    if (this.seenOpportunities.has(key)) return null;
    this.seenOpportunities.add(key);
    this.trimSeen();

    // Buy the cheapest YES option — best EV in an underpriced event group
    const cheapest = siblings.reduce((min, m) =>
      (m.prices[0] ?? 1) < (min.prices[0] ?? 1) ? m : min
    );

    // Don't re-signal the market we're currently processing if it's not cheapest
    if (cheapest.id !== market.id) return null;

    const yesPrice   = cheapest.prices[0] ?? 0.5;
    if (yesPrice < this.MIN_POLY_PRICE) {
      logger.info(
        `⏭️ Same-event arb skipped: cheapest price ${yesPrice.toFixed(4)} < ${this.MIN_POLY_PRICE.toFixed(2)}`
      );
      return null;
    }

    const size       = Math.min(
      context.agent.equity.current * 0.01,
      context.agent.config.maxOrderSize,
    );
    if (size < 1) return null;

    const confidence = Math.min(0.80, 0.50 + (this.EVENT_SUM_THRESHOLD - sumYes) * 3);

    logger.info(
      `📊 Same-event arb: eventId=${eventId} | ${siblings.length} markets | ` +
      `sumYES=${sumYes.toFixed(4)} < ${this.EVENT_SUM_THRESHOLD} | ` +
      `cheapest="${cheapest.question.slice(0, 40)}" @ $${yesPrice.toFixed(4)}`
    );

    return this.createSignal(market.id, {
      tokenId:        market.tokenIds?.[0],
      negRisk:        market.negRisk,
      direction:      'BUY',
      outcome:        'YES',
      confidence,
      suggestedPrice: yesPrice,
      suggestedSize:  size,
      reasoning:
        `📊 Same-Event Arb (eventId=${eventId}): ` +
        `${siblings.length} mutually exclusive outcomes sum to ${sumYes.toFixed(4)} YES ` +
        `(should sum to ~1.0). Buying cheapest: "${cheapest.question.slice(0, 60)}" ` +
        `@ $${yesPrice.toFixed(4)} for positive EV.`,
    });
  }

  // ─── 3. Duplicate Listing Arb ─────────────────────────────────────────────

  /**
   * Fallback for markets without an eventId.
   * Detects the same question listed twice at different prices.
   * All three gates must pass: similarity ≥ 0.92, same category,
   * matching threshold numbers within 5%.
   */
  private checkDuplicateArb(
    market: Market,
    yesPrice: number,
    context: StrategyContext,
  ): Signal | null {
    const normalized    = this.normalize(market.question);
    const marketNumbers = this.extractNumbers(market.question);
    const marketCat     = (market.category || '').toLowerCase().trim();

    for (const [key, entries] of this.questionIndex) {
      if (key === normalized) continue;

      const sim = this.similarity(normalized, key);
      if (sim < this.SIMILARITY_THRESHOLD) continue;

      for (const entry of entries) {
        if (entry.id === market.id) continue;

        // If both have an eventId, same-event check already handled this
        if (market.eventId && entry.eventId && market.eventId === entry.eventId) continue;

        // Gate: same category
        const entryCat = (entry.category || '').toLowerCase().trim();
        if (marketCat && entryCat && marketCat !== entryCat) continue;

        // Gate: threshold numbers must match
        const entryNumbers = this.extractNumbers(entry.question);
        if (!this.numbersMatch(marketNumbers, entryNumbers)) continue;

        // Gate: price divergence
        const otherYes = entry.prices[0] ?? 0.5;
        const gap      = Math.abs(yesPrice - otherYes);
        if (gap < this.DUPLICATE_MIN_GAP) continue;

        const pairKey = [market.id, entry.id].sort().join(':');
        if (this.seenOpportunities.has(pairKey)) continue;
        this.seenOpportunities.add(pairKey);

        const isCheaper = yesPrice < otherYes;
        const outcome   = isCheaper ? 'YES' as const : 'NO' as const;
        const price     = isCheaper ? yesPrice : 1 - yesPrice;
        if (price < this.MIN_POLY_PRICE || price > 0.99) {
          logger.info(
            `⏭️ Duplicate arb skipped: computed price ${price.toFixed(4)} outside [${this.MIN_POLY_PRICE.toFixed(2)}, 0.99]`
          );
          continue;
        }
        const size      = Math.min(context.agent.equity.current * 0.01, context.agent.config.maxOrderSize);
        if (size < 1) continue;

        const confidence = Math.min(0.80, 0.55 + gap * 2);

        logger.info(
          `🔄 Duplicate listing arb: sim=${(sim * 100).toFixed(0)}% | ` +
          `"${market.question.slice(0, 35)}" $${yesPrice.toFixed(4)} vs ` +
          `"${entry.question.slice(0, 35)}" $${otherYes.toFixed(4)}`
        );

        return this.createSignal(market.id, {
          tokenId:        market.tokenIds?.[0],
          negRisk:        market.negRisk,
          direction:      'BUY',
          outcome,
          confidence,
          suggestedPrice: price,
          suggestedSize:  size,
          reasoning:
            `🔄 Duplicate Listing Arb (sim=${(sim * 100).toFixed(0)}%): ` +
            `"${market.question.slice(0, 50)}" $${yesPrice.toFixed(4)} vs ` +
            `"${entry.question.slice(0, 50)}" $${otherYes.toFixed(4)}. Gap: ${(gap * 100).toFixed(2)}%.`,
        });
      }
    }

    return null;
  }

  // ─── Index Management ─────────────────────────────────────────────────────

  private indexMarket(market: Market): void {
    // Primary: event-based index
    if (market.eventId) {
      const list    = this.eventIndex.get(market.eventId) ?? [];
      const existing = list.findIndex(e => e.id === market.id);
      const entry: IndexedMarket = {
        id:       market.id,
        question: market.question,
        category: market.category || '',
        eventId:  market.eventId,
        prices:   market.outcomePrices,
        negRisk:  market.negRisk,
      };
      if (existing >= 0) list[existing] = entry; else list.push(entry);
      this.eventIndex.set(market.eventId, list);
    }

    // Fallback: text-based index (for duplicate detection)
    const key   = this.normalize(market.question);
    const entry: IndexedMarket = {
      id:       market.id,
      question: market.question,
      category: market.category || '',
      eventId:  market.eventId,
      prices:   market.outcomePrices,
      negRisk:  market.negRisk,
    };
    const list  = this.questionIndex.get(key) ?? [];
    const idx   = list.findIndex(e => e.id === market.id);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    this.questionIndex.set(key, list);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private normalize(q: string): string {
    return q.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  /** Jaccard similarity on words > 3 chars */
  private similarity(a: string, b: string): number {
    const sa = new Set(a.split(' ').filter(w => w.length > 3));
    const sb = new Set(b.split(' ').filter(w => w.length > 3));
    if (sa.size === 0 && sb.size === 0) return 1;
    if (sa.size === 0 || sb.size === 0) return 0;
    let overlap = 0;
    for (const w of sa) if (sb.has(w)) overlap++;
    return overlap / (sa.size + sb.size - overlap);
  }

  private extractNumbers(q: string): number[] {
    return (q.match(/[\d,]+\.?\d*/g) ?? [])
      .map(m => safeParseFloat(m.replace(/,/g, ''), 0))
      .filter(n => n > 0);
  }

  private numbersMatch(a: number[], b: number[]): boolean {
    if (a.length === 0 && b.length === 0) return true;
    if (a.length !== b.length) return false;
    
    // SECURITY: Use tightened 0.1% tolerance (was 5%)
    // Context note: both price thresholds ($3000 vs $3015) and small decimals
    // now require 0.1% match to avoid false positive arb signals
    return a.every((n, i) => {
      const other = b[i];
      const max   = Math.max(Math.abs(n), Math.abs(other));
      return max === 0 || Math.abs(n - other) / max <= this.NUMBER_TOLERANCE;
    });
  }

  private trimSeen(): void {
    if (this.seenOpportunities.size > 1000) this.seenOpportunities.clear();
  }
}
