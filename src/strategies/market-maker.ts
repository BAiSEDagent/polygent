import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { logger } from '../utils/logger';

/**
 * Market Maker — Polymarket Spread Provisioning v1.0.0
 *
 * ⚠️  NOT traditional exchange market making.
 *
 * Traditional exchange MM works because makers earn REBATES (e.g., -0.02%
 * on Binance). Polymarket has NO maker rebates — you pay the 2% taker fee
 * regardless. A naive "quote both sides" approach loses money on every fill.
 *
 * WHAT ACTUALLY WORKS ON POLYMARKET:
 * ──────────────────────────────────
 * "Passive Spread Provisioning" — hunt markets where the YES+NO sum leaves
 * enough gap to cover both legs and still profit:
 *
 *   YES price + NO price < (1.0 − MIN_NET_SPREAD)
 *   e.g. YES=0.44, NO=0.44, sum=0.88. Gap=0.12. Fees=0.04. Net=0.08. ✅
 *
 * When a valid gap exists:
 *   1. Buy BOTH YES and NO at the quoted prices
 *   2. Hold until resolution — one side pays $1.00, other pays $0.00
 *   3. Profit = gap − fees
 *
 * INVENTORY DELTA:
 * ────────────────
 * In paper mode, we track net position per market:
 *   delta = YES_shares − NO_shares
 *
 * If delta > MAX_DELTA (too long YES) → only quote NO next cycle
 * If delta < −MAX_DELTA (too long NO) → only quote YES next cycle
 *
 * VOLATILITY CIRCUIT BREAKER:
 * ────────────────────────────
 * If the YES price moves >2% in the last 15-minute window, pull all
 * quotes for that market. Moving markets hurt inventory managers.
 *
 * REVENUE TRACKING:
 * ─────────────────
 * maker_fee is estimated as 2% of each trade notional and stored
 * separately in paper_trades so spread revenue is visible on the leaderboard
 * independently from arb profits.
 *
 * TARGET MARKETS: BTC/ETH price bracket markets (high volume, predictable structure)
 * REFRESH RATE: 15 seconds (set intervalMs: 15_000 in registerAgent)
 */

interface InventoryPosition {
  yesShares: number;
  noShares: number;
  lastPrice: number;
  entryTime: number;
}

export class MarketMakerStrategy extends BaseStrategy {
  readonly name        = 'market_maker';
  readonly description = 'Passive spread provisioning — capture YES+NO gap on liquid markets';
  readonly version     = '1.0.0';

  // Minimum spread after 2% × 2 legs = 4% fees. We require 6% to leave profit.
  private readonly MIN_NET_SPREAD = 0.06;

  // Maximum net delta before we stop quoting one side (inventory risk limit)
  private readonly MAX_INVENTORY_DELTA = 200; // shares

  // Volatility circuit breaker: max YES price move in last window
  private readonly VOLATILITY_THRESHOLD = 0.02; // 2%

  // Only target high-volume markets (thin books have huge slippage)
  private readonly MIN_LIQUIDITY = 1_000; // $1k minimum liquidity

  // Target categories (high-frequency, well-understood markets)
  private readonly TARGET_CATEGORIES = ['crypto', 'finance', 'economics'];

  // Per-market inventory tracking
  private inventory = new Map<string, InventoryPosition>();
  // Per-market price history for volatility check
  private priceHistory = new Map<string, Array<{ price: number; ts: number }>>();

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    if (!market.active || market.closed) return null;
    if (market.outcomePrices.length < 2) return null;

    // Category filter — only restrict if category is populated.
    // Many Gamma API markets have empty category; scan all liquid markets.
    const cat = (market.category || '').toLowerCase();
    if (cat && !this.TARGET_CATEGORIES.some(c => cat.includes(c))) return null;

    // Liquidity filter — avoid thin books
    if ((market.liquidity || 0) < this.MIN_LIQUIDITY) return null;

    const yesPrice = market.outcomePrices[0];
    const noPrice  = market.outcomePrices[1];

    // Track price history for volatility check
    this.recordPrice(market.id, yesPrice);

    // Volatility circuit breaker — pull quotes on fast-moving markets
    if (this.isVolatile(market.id)) {
      logger.debug(`[MM] Volatility circuit breaker: ${market.question.slice(0, 40)}`);
      return null;
    }

    // Core spread check: is there enough gap to profit after fees?
    const sum    = yesPrice + noPrice;
    const spread = 1.0 - sum;
    if (spread < this.MIN_NET_SPREAD) return null;

    // Get current inventory for this market
    const inv   = this.inventory.get(market.id) ?? { yesShares: 0, noShares: 0, lastPrice: yesPrice, entryTime: 0 };
    const delta = inv.yesShares - inv.noShares; // + = long YES, − = long NO

    // Decide which side to quote based on inventory balance
    const quoteSide = this.selectQuoteSide(delta, yesPrice, noPrice);
    if (!quoteSide) return null;

    const { outcome, price } = quoteSide;
    const size     = this.calcSize(spread, context.agent.equity.current, context.agent.config.maxOrderSize);
    if (size < 1) return null;

    const estimatedFee   = size * price * 0.02; // 2% Polymarket taker fee
    const estimatedProfit = size * spread - estimatedFee * 2; // Both legs

    logger.info(
      `📊 MM spread: "${market.question.slice(0, 45)}" | ` +
      `YES=${yesPrice.toFixed(3)} NO=${noPrice.toFixed(3)} spread=${(spread * 100).toFixed(1)}% | ` +
      `delta=${delta.toFixed(0)} quoting=${outcome} | est.profit/lot=$${estimatedProfit.toFixed(2)}`
    );

    // Update inventory (paper only — simulate the fill)
    const updatedInv = { ...inv };
    if (outcome === 'YES') updatedInv.yesShares += size;
    else updatedInv.noShares += size;
    updatedInv.lastPrice = price;
    updatedInv.entryTime = Date.now();
    this.inventory.set(market.id, updatedInv);

    const netDelta     = updatedInv.yesShares - updatedInv.noShares;
    const confidence   = Math.min(0.88, 0.60 + spread * 3);

    return this.createSignal(market.id, {
      tokenId:        outcome === 'YES' ? market.tokenIds?.[0] : market.tokenIds?.[1],
      negRisk:        market.negRisk,
      direction:      'BUY',
      outcome,
      confidence,
      suggestedPrice: price,
      suggestedSize:  size,
      reasoning:
        `📊 MM Spread Provisioning: YES(${yesPrice.toFixed(4)})+NO(${noPrice.toFixed(4)})=${sum.toFixed(4)}. ` +
        `Net spread=${(spread * 100).toFixed(2)}% (min ${(this.MIN_NET_SPREAD * 100).toFixed(0)}%). ` +
        `Est. fee=$${estimatedFee.toFixed(2)} | Est. profit/lot=$${estimatedProfit.toFixed(2)}. ` +
        `Inventory delta=${netDelta.toFixed(0)} (quoting ${outcome} to balance). ` +
        `maker_fee=${estimatedFee.toFixed(4)}`,
    });
  }

  /**
   * Select which side to quote based on current inventory delta.
   * If balanced, quote the cheaper side (better EV).
   * If skewed, quote the underweight side to rebalance.
   */
  private selectQuoteSide(
    delta: number,
    yesPrice: number,
    noPrice: number,
  ): { outcome: 'YES' | 'NO'; price: number } | null {
    // Inventory limit: if heavily skewed, only quote to rebalance
    if (delta > this.MAX_INVENTORY_DELTA) {
      // Too long YES — only quote NO
      return { outcome: 'NO', price: noPrice };
    }
    if (delta < -this.MAX_INVENTORY_DELTA) {
      // Too long NO — only quote YES
      return { outcome: 'YES', price: yesPrice };
    }

    // Balanced: quote whichever side has the lower price (worse odds → more mispriced)
    if (yesPrice <= noPrice) return { outcome: 'YES', price: yesPrice };
    return { outcome: 'NO', price: noPrice };
  }

  /** Position sizing: use 1% of equity per quote, capped by maxOrderSize */
  private calcSize(spread: number, equity: number, maxOrderSize: number): number {
    // Size proportional to spread quality but capped tightly
    const base = equity * 0.01;
    return Math.min(base, maxOrderSize);
  }

  /** Record price tick for volatility tracking */
  private recordPrice(marketId: string, price: number): void {
    const history = this.priceHistory.get(marketId) ?? [];
    history.push({ price, ts: Date.now() });
    // Keep 15 minutes of ticks at 15s intervals = 60 entries max
    if (history.length > 60) history.shift();
    this.priceHistory.set(marketId, history);
  }

  /** Return true if market moved >VOLATILITY_THRESHOLD in the last window */
  private isVolatile(marketId: string): boolean {
    const history = this.priceHistory.get(marketId);
    if (!history || history.length < 2) return false;

    const windowMs = 15 * 60 * 1000; // 15 minutes
    const now      = Date.now();
    const recent   = history.filter(h => now - h.ts <= windowMs);
    if (recent.length < 2) return false;

    const oldest = recent[0].price;
    const newest = recent[recent.length - 1].price;
    return Math.abs(newest - oldest) / oldest >= this.VOLATILITY_THRESHOLD;
  }

  /** Expose inventory state for monitoring */
  getInventorySummary(): Array<{ marketId: string; delta: number; yesShares: number; noShares: number }> {
    return Array.from(this.inventory.entries()).map(([id, inv]) => ({
      marketId: id,
      delta:    inv.yesShares - inv.noShares,
      yesShares: inv.yesShares,
      noShares:  inv.noShares,
    }));
  }
}
