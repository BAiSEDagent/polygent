import { Order, Trade, OrderStatus, Position } from '../utils/types';
import { sanitizeObject } from '../utils/sanitize';
import { getDb } from '../core/db';

interface OrderRow {
  id: string;
  agent_id: string;
  market_id: string;
  side: string;
  outcome: string;
  amount: number;
  price: number;
  type: string;
  status: string;
  filled_amount: number;
  clob_order_id: string | null;
  source: string;
  created_at: number;
  updated_at: number;
}

interface TradeRow {
  id: string;
  order_id: string;
  agent_id: string;
  market_id: string;
  side: string;
  outcome: string;
  amount: number;
  price: number;
  source: string;
  timestamp: number;
}

function orderRowToModel(row: OrderRow): Order {
  return {
    id: row.id,
    agentId: row.agent_id,
    marketId: row.market_id,
    side: row.side as Order['side'],
    outcome: row.outcome as Order['outcome'],
    amount: row.amount,
    price: row.price,
    type: row.type as Order['type'],
    status: row.status as OrderStatus,
    filledAmount: row.filled_amount,
    clobOrderId: row.clob_order_id,
    source: row.source as Order['source'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tradeRowToModel(row: TradeRow): Trade {
  return {
    id: row.id,
    orderId: row.order_id,
    agentId: row.agent_id,
    marketId: row.market_id,
    side: row.side as Trade['side'],
    outcome: row.outcome as Trade['outcome'],
    amount: row.amount,
    price: row.price,
    source: row.source as Trade['source'],
    timestamp: row.timestamp,
  };
}

class TradeStore {
  addOrder(order: Order): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO orders
        (id, agent_id, market_id, side, outcome, amount, price, type, status,
         filled_amount, clob_order_id, source, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order.id,
      order.agentId,
      order.marketId,
      order.side,
      order.outcome,
      order.amount,
      order.price,
      order.type,
      order.status,
      order.filledAmount,
      order.clobOrderId,
      order.source,
      order.createdAt,
      order.updatedAt,
    );
  }

  getOrder(id: string): Order | undefined {
    const row = getDb()
      .prepare('SELECT * FROM orders WHERE id = ?')
      .get(id) as OrderRow | undefined;
    return row ? orderRowToModel(row) : undefined;
  }

  updateOrder(id: string, updates: Partial<Order>): Order | undefined {
    const existing = this.getOrder(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...sanitizeObject(updates), updatedAt: Date.now() };

    getDb().prepare(`
      UPDATE orders SET
        agent_id = ?,
        market_id = ?,
        side = ?,
        outcome = ?,
        amount = ?,
        price = ?,
        type = ?,
        status = ?,
        filled_amount = ?,
        clob_order_id = ?,
        source = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      merged.agentId,
      merged.marketId,
      merged.side,
      merged.outcome,
      merged.amount,
      merged.price,
      merged.type,
      merged.status,
      merged.filledAmount,
      merged.clobOrderId,
      merged.source,
      merged.updatedAt,
      id,
    );

    return this.getOrder(id);
  }

  getAgentOrders(agentId: string, status?: OrderStatus): Order[] {
    let rows: OrderRow[];
    if (status) {
      rows = getDb()
        .prepare('SELECT * FROM orders WHERE agent_id = ? AND status = ? ORDER BY created_at DESC')
        .all(agentId, status) as OrderRow[];
    } else {
      rows = getDb()
        .prepare('SELECT * FROM orders WHERE agent_id = ? ORDER BY created_at DESC')
        .all(agentId) as OrderRow[];
    }
    return rows.map(orderRowToModel);
  }

  getOpenOrderCount(): number {
    const row = getDb()
      .prepare("SELECT COUNT(*) as cnt FROM orders WHERE status IN ('open', 'pending')")
      .get() as { cnt: number };
    return row.cnt;
  }

  addTrade(trade: Trade): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO trades
        (id, order_id, agent_id, market_id, side, outcome, amount, price, source, timestamp)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trade.id,
      trade.orderId,
      trade.agentId,
      trade.marketId,
      trade.side,
      trade.outcome,
      trade.amount,
      trade.price,
      trade.source,
      trade.timestamp,
    );
  }

  getAgentTrades(agentId: string, limit = 50): Trade[] {
    const rows = getDb()
      .prepare('SELECT * FROM trades WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?')
      .all(agentId, limit) as TradeRow[];
    return rows.map(tradeRowToModel);
  }

  getRecentTrades(limit = 50): Trade[] {
    const rows = getDb()
      .prepare('SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as TradeRow[];
    return rows.map(tradeRowToModel);
  }

  /** Calculate positions for an agent from trade history */
  getAgentPositions(agentId: string): Position[] {
    const rows = getDb()
      .prepare('SELECT * FROM trades WHERE agent_id = ? ORDER BY timestamp ASC')
      .all(agentId) as TradeRow[];
    const agentTrades = rows.map(tradeRowToModel);

    const posMap = new Map<string, Position>();

    for (const trade of agentTrades) {
      const key = `${trade.marketId}:${trade.outcome}`;
      const existing = posMap.get(key);

      if (!existing) {
        posMap.set(key, {
          marketId: trade.marketId,
          outcome: trade.outcome,
          size: trade.side === 'BUY' ? trade.amount : -trade.amount,
          avgPrice: trade.price,
          currentPrice: trade.price,
          unrealizedPnl: 0,
        });
      } else {
        const delta = trade.side === 'BUY' ? trade.amount : -trade.amount;
        if (delta > 0 && existing.size > 0) {
          // Adding to position — update avg price
          const totalCost = existing.avgPrice * existing.size + trade.price * trade.amount;
          existing.size += delta;
          existing.avgPrice = existing.size > 0 ? totalCost / existing.size : 0;
        } else {
          existing.size += delta;
        }
      }
    }

    // Filter out closed positions (size ≈ 0)
    return Array.from(posMap.values()).filter((p) => Math.abs(p.size) > 0.001);
  }

  /** Calculate total exposure (sum of |position| * currentPrice) */
  getAgentExposure(agentId: string): number {
    const positions = this.getAgentPositions(agentId);
    return positions.reduce((sum, p) => sum + Math.abs(p.size) * p.currentPrice, 0);
  }

  /** Get unique market count for an agent */
  getAgentMarketCount(agentId: string): number {
    const positions = this.getAgentPositions(agentId);
    return new Set(positions.map((p) => p.marketId)).size;
  }

  /** Prune stale data to prevent unbounded growth (no-op for SQLite — WAL handles this) */
  pruneStaleData(): void {
    const staleAge = Date.now() - 24 * 60 * 60 * 1000;
    getDb().prepare(`
      DELETE FROM orders
      WHERE status IN ('filled', 'cancelled', 'rejected')
        AND updated_at < ?
    `).run(staleAge);
  }
}

export const tradeStore = new TradeStore();
