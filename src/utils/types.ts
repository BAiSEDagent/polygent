// ─── Agent ───────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description?: string;
  strategy?: string;
  apiKeyHash: string;
  walletAddress: string | null;
  // privateKey removed - now stored in secure key store
  proxyWallet: string | null;
  status: AgentStatus;
  config: AgentConfig;
  equity: AgentEquity;
  lastActivity?: number;
  registeredViaApi?: boolean;
  autoRedeem?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type AgentStatus = 'active' | 'inactive' | 'circuit_break';

export interface AgentConfig {
  maxPositionPct: number;
  maxDrawdownPct: number;
  maxOrderSize: number;
  dailyLossLimitPct: number;
  maxExposure: number;
  minDiversification: number;
}

export interface AgentEquity {
  deposited: number;
  current: number;
  peakEquity: number;
  dailyStartEquity: number;
}

export interface AgentCreateRequest {
  name: string;
  description?: string;
  strategy?: string;
  deposit?: number;
  config?: Partial<AgentConfig>;
}

export interface AgentCreateResponse {
  id: string;
  name: string;
  apiKey: string; // Only returned once
  walletAddress: string | null;
  status: AgentStatus;
}

// ─── Orders & Trades ─────────────────────────────────────────────────────────

export type OrderSide = 'BUY' | 'SELL';
export type OrderOutcome = 'YES' | 'NO';
export type OrderStatus = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
export type OrderType = 'LIMIT' | 'MARKET' | 'FOK';

export interface OrderRequest {
  marketId: string;
  side: OrderSide;
  outcome: OrderOutcome;
  amount: number;
  price: number;
  type?: OrderType;
  maxSlippage?: number; // Optional slippage protection (default 2%)
}

export type TradeSource = 'live' | 'paper' | 'mock';

export interface Order {
  id: string;
  agentId: string;
  marketId: string;
  side: OrderSide;
  outcome: OrderOutcome;
  amount: number;
  price: number;
  type: OrderType;
  status: OrderStatus;
  filledAmount: number;
  clobOrderId: string | null;
  source: TradeSource;
  createdAt: number;
  updatedAt: number;
}

export interface Trade {
  id: string;
  orderId: string;
  agentId: string;
  marketId: string;
  side: OrderSide;
  outcome: OrderOutcome;
  amount: number;
  price: number;
  source: TradeSource;
  timestamp: number;
}

// ─── Markets ─────────────────────────────────────────────────────────────────

export interface Market {
  id: string;
  conditionId: string;
  questionId: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomePrices: number[];
  tokenIds: string[];
  negRisk: boolean;
  volume: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  closed: boolean;
  category: string;
  tags: string[];
  /** Gamma API event group ID. Markets sharing the same eventId are outcomes
   *  of the same underlying real-world event (e.g. all temp brackets for
   *  "London high temp on Feb 22"). Used by ArbitrageStrategy for
   *  institutional-grade event-based grouping instead of text matching. */
  eventId?: string;
}

// ─── Portfolio ───────────────────────────────────────────────────────────────

export interface Position {
  marketId: string;
  outcome: OrderOutcome;
  size: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  marketQuestion?: string;
}

export interface Portfolio {
  agentId: string;
  positions: Position[];
  totalEquity: number;
  totalPnl: number;
  totalPnlPct: number;
  openExposure: number;
}

// ─── Risk ────────────────────────────────────────────────────────────────────

export type RiskResult =
  | { approved: true }
  | { approved: false; reason: string; rule: string };

// ─── Strategy ────────────────────────────────────────────────────────────────

export interface Signal {
  strategyName: string;
  marketId: string;
  direction: OrderSide;
  outcome: OrderOutcome;
  confidence: number;
  suggestedPrice: number;
  suggestedSize: number;
  reasoning: string;
  timestamp: number;
  // Live trading fields
  tokenId?: string;
  price?: number;
  amount?: number;
  negRisk?: boolean;
}

export interface StrategyContext {
  agent: Agent;
  portfolio: Portfolio;
  recentTrades: Trade[];
}

// ─── WebSocket ───────────────────────────────────────────────────────────────

export type WSMessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'market_update'
  | 'price_tick'
  | 'trade_event'
  | 'error';

export interface WSMessage {
  type: WSMessageType;
  channels?: string[];
  data?: unknown;
  error?: string;
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: number;
  agents: number;
  openOrders: number;
}
