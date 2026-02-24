/**
 * Builder Fee Revenue Calculation
 * 
 * Polymarket Builder Program revenue tracking.
 * 
 * Fee Model:
 * - Most markets: 0% fees (no builder revenue)
 * - Fee-enabled markets (5min/15min crypto, sports): taker fees apply
 * - Builder share: configurable via BUILDER_FEE_SHARE env var (default 20%)
 * 
 * Taker Fee Formula (from Polymarket fee curve):
 *   taker_fee = notional × price × 0.25 × (price × (1-price))²
 * 
 * Builder Fee:
 *   builder_fee = taker_fee × BUILDER_FEE_SHARE
 */

import { getDb } from '../core/db';
import { logger } from './logger';

export interface BuilderFeeRecord {
  id: string;
  tradeId?: string;
  marketId: string;
  marketQuestion?: string;
  notionalUsd: number;
  price: number;
  takerFeeUsd: number;
  builderFeeUsd: number;
  builderFeeShare: number;
  timestamp: number;
}

/**
 * Calculate taker fee using Polymarket's fee curve.
 * Formula: notional × price × 0.25 × (price × (1-price))²
 */
export function calcTakerFee(notionalUsd: number, price: number): number {
  if (price <= 0 || price >= 1) return 0;
  return notionalUsd * price * 0.25 * Math.pow(price * (1 - price), 2);
}

/**
 * Calculate builder fee from taker fee.
 * Uses BUILDER_FEE_SHARE env var (default: 0.20 = 20%)
 */
export function calcBuilderFee(takerFeeUsd: number): number {
  const share = Number(process.env.BUILDER_FEE_SHARE || '0.20');
  return takerFeeUsd * share;
}

/**
 * Get current builder fee share percentage.
 */
export function getBuilderFeeShare(): number {
  return Number(process.env.BUILDER_FEE_SHARE || '0.20');
}

/**
 * Record a builder fee for a trade.
 * Called after every confirmed relay trade.
 */
export function recordBuilderFee(record: BuilderFeeRecord): void {
  const db = getDb();
  try {
    db.prepare(`
      INSERT OR IGNORE INTO builder_fees (
        id, trade_id, market_id, market_question,
        notional_usd, price, taker_fee_usd, builder_fee_usd, builder_fee_share,
        timestamp
      ) VALUES (
        @id, @tradeId, @marketId, @marketQuestion,
        @notionalUsd, @price, @takerFeeUsd, @builderFeeUsd, @builderFeeShare,
        @timestamp
      )
    `).run({
      id: record.id,
      tradeId: record.tradeId || null,
      marketId: record.marketId,
      marketQuestion: record.marketQuestion || null,
      notionalUsd: record.notionalUsd,
      price: record.price,
      takerFeeUsd: record.takerFeeUsd,
      builderFeeUsd: record.builderFeeUsd,
      builderFeeShare: record.builderFeeShare,
      timestamp: record.timestamp,
    });

    logger.info(`Builder fee recorded: $${record.builderFeeUsd.toFixed(4)} on ${record.marketId.slice(0, 16)}...`);
  } catch (err) {
    logger.warn('Failed to record builder fee', {
      id: record.id,
      error: (err as Error).message,
    });
  }
}

/**
 * Get total builder fees earned (all time).
 */
export function getTotalBuilderFees(): number {
  const db = getDb();
  try {
    const result = db.prepare('SELECT SUM(builder_fee_usd) as total FROM builder_fees').get() as any;
    return result?.total || 0;
  } catch (err) {
    logger.warn('Failed to query total builder fees', { error: (err as Error).message });
    return 0;
  }
}

/**
 * Get daily builder fee breakdown.
 * Returns array of { date: 'YYYY-MM-DD', fees: number }
 */
export function getDailyBuilderFees(days: number = 30): Array<{ date: string; fees: number }> {
  const db = getDb();
  try {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = db.prepare(`
      SELECT 
        DATE(timestamp / 1000, 'unixepoch') as date,
        SUM(builder_fee_usd) as fees
      FROM builder_fees
      WHERE timestamp >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(cutoff) as any[];

    return rows.map(r => ({ date: r.date, fees: r.fees }));
  } catch (err) {
    logger.warn('Failed to query daily builder fees', { error: (err as Error).message });
    return [];
  }
}

/**
 * Backfill builder fees from historical trades table.
 * Run once on first deployment.
 */
export function backfillBuilderFeesFromTrades(): number {
  const db = getDb();
  try {
    // Get all trades that don't have builder fee records yet
    const trades = db.prepare(`
      SELECT t.id, t.market_id, t.amount, t.price, t.timestamp
      FROM trades t
      LEFT JOIN builder_fees bf ON t.id = bf.trade_id
      WHERE bf.id IS NULL
    `).all() as any[];

    let backfilled = 0;
    for (const trade of trades) {
      const notional = trade.amount * trade.price;
      const takerFee = calcTakerFee(notional, trade.price);
      const builderFee = calcBuilderFee(takerFee);

      recordBuilderFee({
        id: `fee_${trade.id}`,
        tradeId: trade.id,
        marketId: trade.market_id,
        notionalUsd: notional,
        price: trade.price,
        takerFeeUsd: takerFee,
        builderFeeUsd: builderFee,
        builderFeeShare: getBuilderFeeShare(),
        timestamp: trade.timestamp,
      });

      backfilled++;
    }

    if (backfilled > 0) {
      logger.info(`Backfilled ${backfilled} builder fee records from historical trades`);
    }

    return backfilled;
  } catch (err) {
    logger.error('Failed to backfill builder fees', { error: (err as Error).message });
    return 0;
  }
}
