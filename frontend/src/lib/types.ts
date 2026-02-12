export interface AgentPerformance {
  agentId: string;
  agentName: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentEquity: number;
  depositedEquity: number;
}

export interface RunnerAgent {
  agentId: string;
  name: string;
  strategy: string;
  status: string;
  equity: number;
  deposited: number;
  pnl: number;
  totalSignals: number;
  totalTrades: number;
  errors: number;
  lastRun: number;
}

export interface AgentActivity {
  agentId: string;
  agentName: string;
  strategyName: string;
  type: 'signal' | 'trade' | 'error' | 'circuit_break' | 'no_signal';
  data?: {
    marketId?: string;
    direction?: string;
    outcome?: string;
    confidence?: number;
    reasoning?: string;
    side?: string;
    price?: number;
    amount?: number;
    tradeId?: string;
    error?: string;
  };
  timestamp: number;
}

export interface PaperTrade {
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
  timestamp: number;
  slippage: number;
}

export interface Market {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  closed: boolean;
  category: string;
  tags: string[];
}

export interface SystemStats {
  liveData: {
    marketsTracked: number;
    lastUpdate: number;
    updatesReceived: number;
  };
  agents: {
    total: number;
    active: number;
  };
  trading: {
    totalPaperTrades: number;
    totalVolume: number;
  };
}

export interface HealthCheck {
  status: string;
  version: string;
  uptime: number;
  agents: number;
  openOrders: number;
  wsClients: number;
}
