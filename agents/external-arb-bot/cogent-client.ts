/**
 * Cogent API Client SDK
 *
 * A clean, reusable typed client for interacting with the Cogent trading platform.
 * Uses only fetch — no internal module imports.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Market {
  id: string;
  conditionId?: string;
  question: string;
  description?: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  category?: string;
  change24h?: number;
}

export interface MarketDetail {
  market: Market;
  orderbook: OrderBook | null;
}

export interface OrderBook {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

export interface OrderRequest {
  marketId: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  amount: number;
  price: number;
  type?: 'LIMIT' | 'MARKET' | 'FOK';
}

export interface OrderResponse {
  orderId: string;
  clobOrderId?: string;
  status: string;
}

export interface Order {
  id: string;
  agentId: string;
  marketId: string;
  side: string;
  outcome: string;
  amount: number;
  price: number;
  type: string;
  status: string;
  createdAt: number;
}

export interface Portfolio {
  agentId: string;
  positions: Position[];
  totalEquity: number;
  totalPnl: number;
  totalPnlPct: number;
  openExposure: number;
}

export interface Position {
  marketId: string;
  outcome: string;
  size: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  marketQuestion?: string;
}

export interface LeaderboardEntry {
  agentId: string;
  name: string;
  strategy?: string;
  equity: number;
  pnl: number;
  pnlPct: number;
  totalTrades?: number;
  status: string;
}

export interface RegistrationResult {
  id: string;
  name: string;
  apiKey: string;
  walletAddress: string | null;
  status: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class CogentClient {
  private baseUrl: string;
  private apiKey: string | null = null;
  private agentId: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const opts: RequestInit = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const json = await res.json() as any;

    if (!res.ok) {
      throw new Error(`Cogent API ${method} ${path} → ${res.status}: ${json.error ?? JSON.stringify(json)}`);
    }
    return json as T;
  }

  /** Register a new agent. Stores API key internally for subsequent calls. */
  async register(name: string, description: string, strategy?: string): Promise<RegistrationResult> {
    const result = await this.request<RegistrationResult>('POST', '/api/agents', {
      name,
      description,
      strategy,
      deposit: 10_000,
    });
    this.apiKey = result.apiKey;
    this.agentId = result.id;
    return result;
  }

  /** Set API key manually (e.g. for reconnecting) */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  getAgentId(): string | null {
    return this.agentId;
  }

  // ─── Markets ─────────────────────────────────────────────────

  async getMarkets(limit = 20): Promise<Market[]> {
    const data = await this.request<{ markets: Market[] }>('GET', `/api/markets?limit=${limit}`);
    return data.markets;
  }

  async getMarket(id: string): Promise<MarketDetail> {
    return this.request<MarketDetail>('GET', `/api/markets/${id}`);
  }

  async getOrderBook(id: string): Promise<OrderBook | null> {
    try {
      const data = await this.request<{ orderbook: OrderBook }>('GET', `/api/markets/${id}/book`);
      return data.orderbook;
    } catch {
      return null;
    }
  }

  // ─── Orders ──────────────────────────────────────────────────

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    return this.request<OrderResponse>('POST', '/api/orders', order);
  }

  async getOrders(status?: string): Promise<Order[]> {
    const qs = status ? `?status=${status}` : '';
    const data = await this.request<{ orders: Order[] }>('GET', `/api/orders${qs}`);
    return data.orders;
  }

  async cancelOrder(orderId: string): Promise<{ orderId: string; status: string }> {
    return this.request<{ orderId: string; status: string }>('DELETE', `/api/orders/${orderId}`);
  }

  // ─── Portfolio ───────────────────────────────────────────────

  async getPortfolio(): Promise<Portfolio> {
    return this.request<Portfolio>('GET', '/api/portfolio');
  }

  async getTradeHistory(limit = 50): Promise<{ trades: any[]; total: number }> {
    return this.request<{ trades: any[]; total: number }>('GET', `/api/portfolio/history?limit=${limit}`);
  }

  // ─── Leaderboard ─────────────────────────────────────────────

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const data = await this.request<{ leaderboard: LeaderboardEntry[] }>('GET', '/api/leaderboard');
    return data.leaderboard;
  }
}
