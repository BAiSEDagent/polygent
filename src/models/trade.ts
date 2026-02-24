import { Order, Trade, OrderStatus, Position } from '../utils/types';
import { sanitizeObject } from '../utils/sanitize';
import { calcTakerFee, calcBuilderFee, recordBuilderFee, getBuilderFeeShare } from '../utils/builder-fees';

const MAX_TRADES = 50_000;
const MAX_PAPER_TRADES = 50_000;
const STALE_ORDER_AGE_MS = 24 * 60 * 60 * 1000; // 24h

class TradeStore {
  private orders = new Map<string, Order>();
  private trades: Trade[] = [];
  private agentOrderIndex = new Map<string, string[]>(); // agentId → orderIds

  addOrder(order: Order): void {
    this.orders.set(order.id, order);
    const existing = this.agentOrderIndex.get(order.agentId) ?? [];
    existing.push(order.id);
    this.agentOrderIndex.set(order.agentId, existing);
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id);
  }

  updateOrder(id: string, updates: Partial<Order>): Order | undefined {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated = { ...order, ...sanitizeObject(updates), updatedAt: Date.now() };
    this.orders.set(id, updated);
    return updated;
  }

  getAgentOrders(agentId: string, status?: OrderStatus): Order[] {
    const ids = this.agentOrderIndex.get(agentId) ?? [];
    let orders = ids.map((id) => this.orders.get(id)!).filter(Boolean);
    if (status) {
      orders = orders.filter((o) => o.status === status);
    }
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  }

  getOpenOrderCount(): number {
    let count = 0;
    for (const order of this.orders.values()) {
      if (order.status === 'open' || order.status === 'pending') count++;
    }
    return count;
  }

  addTrade(trade: Trade): void {
    this.trades.push(trade);
    if (this.trades.length > MAX_TRADES) {
      this.trades = this.trades.slice(-MAX_TRADES);
    }

    // Record builder fee for this trade (live trades only)
    if (trade.source === 'live') {
      const notional = trade.amount * trade.price;
      const takerFee = calcTakerFee(notional, trade.price);
      const builderFee = calcBuilderFee(takerFee);

      recordBuilderFee({
        id: `fee_${trade.id}`,
        tradeId: trade.id,
        marketId: trade.marketId,
        notionalUsd: notional,
        price: trade.price,
        takerFeeUsd: takerFee,
        builderFeeUsd: builderFee,
        builderFeeShare: getBuilderFeeShare(),
        timestamp: trade.timestamp,
      });
    }
  }

  getAgentTrades(agentId: string, limit = 50): Trade[] {
    return this.trades
      .filter((t) => t.agentId === agentId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getRecentTrades(limit = 50): Trade[] {
    return this.trades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /** Calculate positions for an agent from trade history */
  getAgentPositions(agentId: string): Position[] {
    const agentTrades = this.trades.filter((t) => t.agentId === agentId);
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

  /** Prune stale data to prevent unbounded memory growth */
  pruneStaleData(): void {
    const now = Date.now();
    // Prune filled/cancelled orders older than 24h
    for (const [id, order] of this.orders) {
      if (
        (order.status === 'filled' || order.status === 'cancelled' || order.status === 'rejected') &&
        now - order.updatedAt > STALE_ORDER_AGE_MS
      ) {
        this.orders.delete(id);
      }
    }
    // Cap trades array
    if (this.trades.length > MAX_TRADES) {
      this.trades = this.trades.slice(-MAX_TRADES);
    }
  }
}

export const tradeStore = new TradeStore();
