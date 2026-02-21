/**
 * SQLite persistence layer for agents, orders, and trades.
 *
 * Uses better-sqlite3 for synchronous, zero-dependency persistence.
 * Falls back to in-memory if the file can't be opened (e.g., read-only FS).
 */

import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../utils/logger';

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
  `);

  logger.info('Database migrations applied');
}

export function closeDb(): void {
  if (db) {
    db.close();
    logger.info('Database closed');
  }
}
