/**
 * SQLite persistence layer for agents, orders, trades, and paper trades.
 *
 * Uses better-sqlite3 for synchronous, zero-dependency persistence.
 * Falls back to in-memory if the file can't be opened (e.g., read-only FS).
 */

import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../utils/logger';

// Inline type to avoid circular dependency with paper-trader.ts
export interface PersistedPaperTrade {
  id: string;
  agentId: string;
  strategyName: string;
  marketId: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  requestedPrice: number;
  executedPrice: number;
  amount: number;
  notional: number;
  reasoning: string;
  slippage: number;
  timestamp: number;
  /** Estimated maker fee (2% of notional). Tracked separately for revenue attribution.
   *  Market Maker trades show spread revenue net of fees. 0 for non-MM strategies. */
  makerFee: number;
}

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'polygent.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (db) return db;

  try {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    logger.info(`SQLite database opened at ${DB_PATH}`);
  } catch (err) {
    logger.warn(`Failed to open SQLite at ${DB_PATH}, using in-memory`, {
      error: (err as Error).message,
    });
    db = new Database(':memory:');
  }

  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      strategy TEXT,
      api_key_hash TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      proxy_wallet TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      config_json TEXT NOT NULL DEFAULT '{}',
      equity_json TEXT NOT NULL DEFAULT '{}',
      last_activity INTEGER,
      registered_via_api INTEGER NOT NULL DEFAULT 0,
      auto_redeem INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      market_id TEXT NOT NULL,
      side TEXT NOT NULL,
      outcome TEXT NOT NULL,
      amount REAL NOT NULL,
      price REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'LIMIT',
      status TEXT NOT NULL DEFAULT 'pending',
      filled_amount REAL NOT NULL DEFAULT 0,
      clob_order_id TEXT,
      source TEXT NOT NULL DEFAULT 'live',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      market_id TEXT NOT NULL,
      side TEXT NOT NULL,
      outcome TEXT NOT NULL,
      amount REAL NOT NULL,
      price REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'live',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_agent ON orders(agent_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_trades_agent ON trades(agent_id);
    CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
    CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key_hash);

    CREATE TABLE IF NOT EXISTS copier_delegations (
      id TEXT PRIMARY KEY,
      copier_address TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      fixed_usdc REAL NOT NULL,
      api_key TEXT NOT NULL,
      api_secret_enc TEXT NOT NULL,
      api_passphrase_enc TEXT NOT NULL,
      l2_private_key_enc TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_copier_agent ON copier_delegations(agent_id);
    CREATE INDEX IF NOT EXISTS idx_copier_active ON copier_delegations(active);

    -- Paper trades: no FK constraints so system agents don't need to be in the
    -- agents table. This table is the single source of truth for paper PnL.
    CREATE TABLE IF NOT EXISTS paper_trades (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      strategy_name TEXT NOT NULL,
      market_id TEXT NOT NULL,
      market_question TEXT,
      side TEXT NOT NULL,
      outcome TEXT NOT NULL,
      requested_price REAL NOT NULL,
      executed_price REAL NOT NULL,
      amount REAL NOT NULL,
      notional REAL NOT NULL,
      reasoning TEXT,
      slippage REAL NOT NULL DEFAULT 0,
      maker_fee REAL NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_paper_agent ON paper_trades(agent_id);
    CREATE INDEX IF NOT EXISTS idx_paper_strategy ON paper_trades(strategy_name);
    CREATE INDEX IF NOT EXISTS idx_paper_timestamp ON paper_trades(timestamp);

    -- Builder fees: track revenue earned from relay trades
    CREATE TABLE IF NOT EXISTS builder_fees (
      id TEXT PRIMARY KEY,
      trade_id TEXT,
      market_id TEXT NOT NULL,
      market_question TEXT,
      notional_usd REAL NOT NULL,
      price REAL NOT NULL,
      taker_fee_usd REAL NOT NULL,
      builder_fee_usd REAL NOT NULL,
      builder_fee_share REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (trade_id) REFERENCES trades(id)
    );

    CREATE INDEX IF NOT EXISTS idx_builder_fees_timestamp ON builder_fees(timestamp);
    CREATE INDEX IF NOT EXISTS idx_builder_fees_market ON builder_fees(market_id);
  `);

  // Safe migration: add maker_fee to existing paper_trades tables that were
  // created before this column was added. SQLite requires try/catch for this.
  try {
    db.exec(`ALTER TABLE paper_trades ADD COLUMN maker_fee REAL NOT NULL DEFAULT 0`);
    logger.info('Migrated paper_trades: added maker_fee column');
  } catch {
    // Column already exists — expected on fresh installs with updated schema
  }

  // Safe migration: add auto_redeem to existing agents tables
  try {
    db.exec(`ALTER TABLE agents ADD COLUMN auto_redeem INTEGER NOT NULL DEFAULT 0`);
    logger.info('Migrated agents: added auto_redeem column');
  } catch {
    // Column already exists — expected on fresh installs with updated schema
  }

  logger.info('Database migrations applied');
}

// ─── Paper Trade Persistence ─────────────────────────────────────────────────

/**
 * Persist a paper trade to SQLite.
 * Called synchronously after every paper trade execution.
 */
export function insertPaperTrade(
  trade: PersistedPaperTrade,
  agentName: string,
  marketQuestion?: string
): void {
  const db = getDb();
  try {
    db.prepare(`
      INSERT OR IGNORE INTO paper_trades (
        id, agent_id, agent_name, strategy_name,
        market_id, market_question,
        side, outcome,
        requested_price, executed_price,
        amount, notional, reasoning, slippage, maker_fee, timestamp
      ) VALUES (
        @id, @agentId, @agentName, @strategyName,
        @marketId, @marketQuestion,
        @side, @outcome,
        @requestedPrice, @executedPrice,
        @amount, @notional, @reasoning, @slippage, @makerFee, @timestamp
      )
    `).run({
      id: trade.id,
      agentId: trade.agentId,
      agentName,
      strategyName: trade.strategyName,
      marketId: trade.marketId,
      marketQuestion: marketQuestion ?? null,
      side: trade.side,
      outcome: trade.outcome,
      requestedPrice: trade.requestedPrice,
      executedPrice: trade.executedPrice,
      amount: trade.amount,
      notional: trade.notional,
      reasoning: trade.reasoning ?? null,
      slippage: trade.slippage,
      makerFee: trade.makerFee ?? 0,
      timestamp: trade.timestamp,
    });
  } catch (err) {
    logger.warn('Failed to persist paper trade to SQLite', {
      id: trade.id,
      error: (err as Error).message,
    });
  }
}

/**
 * Load all persisted paper trades from SQLite, sorted oldest→newest.
 * Used on startup to restore in-memory state.
 */
export function loadPaperTrades(): PersistedPaperTrade[] {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT * FROM paper_trades ORDER BY timestamp ASC
    `).all() as any[];

    return rows.map(r => ({
      id: r.id,
      agentId: r.agent_id,
      strategyName: r.strategy_name,
      marketId: r.market_id,
      side: r.side as 'BUY' | 'SELL',
      outcome: r.outcome as 'YES' | 'NO',
      requestedPrice: r.requested_price,
      executedPrice: r.executed_price,
      amount: r.amount,
      notional: r.notional,
      reasoning: r.reasoning ?? '',
      slippage: r.slippage,
      makerFee: r.maker_fee ?? 0,
      timestamp: r.timestamp,
    }));
  } catch (err) {
    logger.warn('Failed to load paper trades from SQLite', {
      error: (err as Error).message,
    });
    return [];
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    logger.info('Database closed');
  }
}
