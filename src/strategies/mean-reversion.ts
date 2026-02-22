import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { logger } from '../utils/logger';

/**
 * Conservative Mean Reversion (CMR) — poly_revert_v1
 *
 * Detects "rubber band" snaps where price stretches too far from
 * its rolling mean due to liquidity gaps or panic, then reverts.
 *
 * Designed for micro-bankroll ($6 USDC.e). Only swings at perfect pitches:
 * Z-score > 2.5 (< 1% occurrence).
 */

interface PriceSnapshot {
  timestamp: number;
  price: number;
}

interface ActivePosition {
  marketId: string;
  entryTime: number;
  entryPrice: number;
  side: 'BUY' | 'SELL';
  tokenId: string;
  negRisk: boolean;
}

export class MeanReversionStrategy extends BaseStrategy {
  readonly name = 'mean_reversion';
  readonly description = 'Conservative Z-score mean reversion with trend filter';
  readonly version = '1.0.0';

  // ── Configuration ──────────────────────────────────────────────────────
  private readonly WINDOW_SIZE = 5;           // 60 x 1-min snapshots
  private readonly Z_ENTRY_THRESHOLD = 1.5;    // Only trade < 1% events
  private readonly Z_EXIT_THRESHOLD = 0.0;     // Exit when price touches mean
  private readonly MOMENTUM_LOOKBACK = 5;      // 5-minute momentum window
  private readonly MAX_MOMENTUM = 0.04;        // Skip if > $0.04 move in 5 min
  private readonly TRADE_SIZE = 2.50;          // $2.50 per trade (5 shares @ ~$0.50)
  private readonly MAX_CONCURRENT = 2;         // Max 2 positions at once
  private readonly MAX_HOLD_MINUTES = 120;     // Force close after 2 hours
  private readonly MIN_SPREAD = 0.02;          // Only tight markets
  private readonly MIN_PRICE = 0.20;           // Avoid binary tails
  private readonly MAX_PRICE = 0.80;           // Avoid binary tails

  // ── State ──────────────────────────────────────────────────────────────
  private priceHistory = new Map<string, PriceSnapshot[]>();
  private activePositions: ActivePosition[] = [];
  private lastTickTime = new Map<string, number>();

  async init(): Promise<void> {
    logger.info('🔬 poly_revert_v1 initialized — Conservative Mean Reversion');
    logger.info(`   Window: ${this.WINDOW_SIZE}min | Z-threshold: ±${this.Z_ENTRY_THRESHOLD} | Size: $${this.TRADE_SIZE}`);
  }

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    // ── Market filter ──────────────────────────────────────────────────
    if (!market.active || market.closed) return null;
    if (market.outcomePrices.length < 2) return null;

    const yesPrice = market.outcomePrices[0];
    const noPrice = market.outcomePrices[1];
    const spread = Math.abs(1 - yesPrice - noPrice);

    // Spread filter: only tight markets
    if (spread > this.MIN_SPREAD) return null;

    // Price range filter: avoid binary tails
    if (yesPrice < this.MIN_PRICE || yesPrice > this.MAX_PRICE) return null;

    // Category filter (optional — politics + crypto have high retail flow)
    const validCategories = ['politics', 'crypto', 'economics', 'finance', 'sports'];
    const cat = (market.category || '').toLowerCase();
    if (validCategories.length > 0 && !validCategories.some(c => cat.includes(c))) return null;

    // ── Ingest price tick ──────────────────────────────────────────────
    const now = Date.now();
    const lastTick = this.lastTickTime.get(market.id) || 0;

    // Only record once per ~55 seconds (avoid duplicate ticks within same minute)
    if (now - lastTick < 55_000) return null;
    this.lastTickTime.set(market.id, now);

    if (!this.priceHistory.has(market.id)) {
      this.priceHistory.set(market.id, []);
    }
    const history = this.priceHistory.get(market.id)!;
    history.push({ timestamp: now, price: yesPrice });

    // Maintain rolling window
    if (history.length > this.WINDOW_SIZE + 10) {
      history.splice(0, history.length - this.WINDOW_SIZE);
    }

    // ── Check for timed-out positions (force close) ────────────────────
    const expiredSignal = this.checkExpiredPositions(market, now);
    if (expiredSignal) return expiredSignal;

    // ── Check for exit signals (Z crosses 0) ───────────────────────────
    const exitSignal = this.checkExitSignal(market, yesPrice, history);
    if (exitSignal) return exitSignal;

    // ── Data sufficiency ───────────────────────────────────────────────
    if (history.length < this.WINDOW_SIZE) {
      // Still building history — log every 10th tick
      if (history.length % 10 === 0) {
        logger.debug(`[CMR] Building history for "${market.question.slice(0, 40)}": ${history.length}/${this.WINDOW_SIZE}`);
      }
      return null;
    }

    // ── Position limit ─────────────────────────────────────────────────
    if (this.activePositions.length >= this.MAX_CONCURRENT) return null;

    // Already have a position in this market
    if (this.activePositions.some(p => p.marketId === market.id)) return null;

    // ── Compute Z-score ────────────────────────────────────────────────
    const prices = history.map(h => h.price);
    const avg = this.mean(prices);
    const stdDev = this.std(prices);

    if (stdDev < 0.001) return null; // No variance — skip flat markets

    const zScore = (yesPrice - avg) / stdDev;

    // ── Trend / Momentum filter ────────────────────────────────────────
    if (history.length >= this.MOMENTUM_LOOKBACK) {
      const priceNow = yesPrice;
      const priceThen = history[history.length - this.MOMENTUM_LOOKBACK].price;
      const momentum = Math.abs(priceNow - priceThen);

      if (momentum > this.MAX_MOMENTUM) {
        logger.debug(`[CMR] Momentum filter triggered for "${market.question.slice(0, 30)}": $${momentum.toFixed(3)} > $${this.MAX_MOMENTUM}`);
        return null;
      }
    }

    // ── Entry signals ──────────────────────────────────────────────────
    if (zScore < -this.Z_ENTRY_THRESHOLD) {
      // Oversold — BUY YES (expect reversion up)
      const tokenId = market.tokenIds[0]; // YES token
      if (!tokenId) return null;

      this.activePositions.push({
        marketId: market.id,
        entryTime: now,
        entryPrice: yesPrice,
        side: 'BUY',
        tokenId,
        negRisk: market.negRisk,
      });

      logger.info(`🔬 [CMR] LONG SIGNAL: Z=${zScore.toFixed(2)} | "${market.question.slice(0, 50)}" @ $${yesPrice.toFixed(3)}`);

      return this.createSignal(market.id, {
        direction: 'BUY',
        outcome: 'YES',
        confidence: Math.min(0.95, 0.6 + Math.abs(zScore) * 0.1),
        suggestedPrice: yesPrice,
        suggestedSize: this.TRADE_SIZE,
        reasoning: `Z-score ${zScore.toFixed(2)} (oversold). Mean: $${avg.toFixed(3)}, StdDev: $${stdDev.toFixed(4)}. Expecting reversion to mean.`,
        tokenId,
        negRisk: market.negRisk,
      });
    }

    if (zScore > this.Z_ENTRY_THRESHOLD) {
      // Overbought — BUY NO (expect reversion down)
      const tokenId = market.tokenIds[1]; // NO token
      if (!tokenId) return null;

      const noTokenPrice = noPrice;

      this.activePositions.push({
        marketId: market.id,
        entryTime: now,
        entryPrice: noTokenPrice,
        side: 'BUY',
        tokenId,
        negRisk: market.negRisk,
      });

      logger.info(`🔬 [CMR] SHORT SIGNAL: Z=${zScore.toFixed(2)} | "${market.question.slice(0, 50)}" @ YES=$${yesPrice.toFixed(3)}`);

      return this.createSignal(market.id, {
        direction: 'BUY',
        outcome: 'NO',
        confidence: Math.min(0.95, 0.6 + Math.abs(zScore) * 0.1),
        suggestedPrice: noTokenPrice,
        suggestedSize: this.TRADE_SIZE,
        reasoning: `Z-score +${zScore.toFixed(2)} (overbought). Mean: $${avg.toFixed(3)}, StdDev: $${stdDev.toFixed(4)}. Buying NO for reversion.`,
        tokenId,
        negRisk: market.negRisk,
      });
    }

    return null;
  }

  // ── Exit logic ───────────────────────────────────────────────────────────

  private checkExitSignal(market: Market, currentPrice: number, history: PriceSnapshot[]): Signal | null {
    const pos = this.activePositions.find(p => p.marketId === market.id);
    if (!pos) return null;

    if (history.length < this.WINDOW_SIZE) return null;

    const prices = history.map(h => h.price);
    const avg = this.mean(prices);
    const stdDev = this.std(prices);
    if (stdDev < 0.001) return null;

    const zScore = (currentPrice - avg) / stdDev;

    // Exit when Z-score crosses 0 (price returned to mean)
    const shouldExit = pos.side === 'BUY'
      ? zScore >= this.Z_EXIT_THRESHOLD  // Was oversold, now at/above mean
      : zScore <= this.Z_EXIT_THRESHOLD; // Was overbought, now at/below mean

    if (shouldExit) {
      this.activePositions = this.activePositions.filter(p => p.marketId !== market.id);
      const pnl = pos.side === 'BUY'
        ? ((currentPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(1)
        : ((pos.entryPrice - currentPrice) / pos.entryPrice * 100).toFixed(1);

      logger.info(`🔬 [CMR] EXIT: Z=${zScore.toFixed(2)} | "${market.question?.slice(0, 40)}" | PnL: ${pnl}%`);

      // Emit a SELL signal for the same token we bought
      return this.createSignal(market.id, {
        direction: 'SELL',
        outcome: pos.side === 'BUY' ? 'YES' : 'NO',
        confidence: 0.8,
        suggestedPrice: currentPrice,
        suggestedSize: this.TRADE_SIZE,
        reasoning: `Mean reversion complete. Z-score ${zScore.toFixed(2)}, exiting position. Entry: $${pos.entryPrice.toFixed(3)}`,
        tokenId: pos.tokenId,
        negRisk: pos.negRisk,
      });
    }

    return null;
  }

  private checkExpiredPositions(market: Market, now: number): Signal | null {
    const pos = this.activePositions.find(p => p.marketId === market.id);
    if (!pos) return null;

    const holdMinutes = (now - pos.entryTime) / 60_000;
    if (holdMinutes < this.MAX_HOLD_MINUTES) return null;

    // Force close — thesis failed, mean has shifted
    this.activePositions = this.activePositions.filter(p => p.marketId !== market.id);
    const currentPrice = market.outcomePrices[0];

    logger.warn(`🔬 [CMR] FORCE CLOSE (${holdMinutes.toFixed(0)}min > ${this.MAX_HOLD_MINUTES}min): "${market.question?.slice(0, 40)}"`);

    return this.createSignal(market.id, {
      direction: 'SELL',
      outcome: pos.side === 'BUY' ? 'YES' : 'NO',
      confidence: 0.7,
      suggestedPrice: currentPrice,
      suggestedSize: this.TRADE_SIZE,
      reasoning: `Force close: held ${holdMinutes.toFixed(0)} minutes (max ${this.MAX_HOLD_MINUTES}). Mean has likely shifted.`,
      tokenId: pos.tokenId,
      negRisk: pos.negRisk,
    });
  }

  // ── Math helpers (no external deps) ──────────────────────────────────────

  private mean(arr: number[]): number {
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
  }

  private std(arr: number[]): number {
    const avg = this.mean(arr);
    const squaredDiffs = arr.map(v => (v - avg) ** 2);
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / arr.length);
  }
}
