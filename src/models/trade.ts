import { Order, Trade, OrderStatus, Position } from '../utils/types';

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
    const updated = { ...order, ...updates, updatedAt: Date.now() };
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
}

export const tradeStore = new TradeStore();
