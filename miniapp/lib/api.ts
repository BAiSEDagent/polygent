import { config } from './config';

// ─── Types (mirror server types for frontend) ─────────────────────────────

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

export interface AgentRunner {
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
  category: string;
  change24h?: number;
  lastUpdate?: number;
}

export interface Trade {
  id: string;
  agentId: string;
  strategyName: string;
  marketId: string;
  side: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  executedPrice: number;
  amount: number;
  reasoning: string;
  timestamp: number;
}

export interface AgentActivity {
  agentId: string;
  agentName: string;
  strategyName: string;
  type: 'signal' | 'trade' | 'error' | 'circuit_break' | 'no_signal';
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface SystemStats {
  liveData: {
    marketsLoaded: number;
    orderbooksCached: number;
    wsConnected: boolean;
    wsSubscriptions: number;
  };
  agents: { total: number; active: number };
  trading: { totalPaperTrades: number; totalVolume: number };
}

// ─── API Client ────────────────────────────────────────────────────────────

async function fetchAPI<T>(path: string): Promise<T> {
  const url = `${config.API_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    // No credentials — all public endpoints
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function getLeaderboard(): Promise<AgentPerformance[]> {
  const data = await fetchAPI<{ leaderboard: AgentPerformance[] }>('/api/leaderboard');
  return data.leaderboard;
}

export async function getRunners(): Promise<AgentRunner[]> {
  // Runners endpoint requires auth — use stats + leaderboard for public data
  const data = await fetchAPI<{ leaderboard: AgentPerformance[] }>('/api/leaderboard');
  return data.leaderboard.map(a => ({
    agentId: a.agentId,
    name: a.agentName,
    strategy: '',
    status: 'active',
    equity: a.currentEquity,
    deposited: a.depositedEquity,
    pnl: a.totalPnl,
    totalSignals: 0,
    totalTrades: a.totalTrades,
    errors: 0,
    lastRun: 0,
  }));
}

export async function getMarkets(limit = 20): Promise<Market[]> {
  const data = await fetchAPI<{ markets: Market[] }>(`/api/markets?limit=${limit}`);
  return data.markets;
}

export async function getMarket(id: string): Promise<Market | null> {
  try {
    const data = await fetchAPI<{ market: Market }>(`/api/markets/${encodeURIComponent(id)}`);
    return data.market;
  } catch {
    return null;
  }
}

export async function getStats(): Promise<SystemStats> {
  return fetchAPI<SystemStats>('/api/stats');
}

export async function getAgentTrades(agentId: string, limit = 50): Promise<Trade[]> {
  const data = await fetchAPI<{ trades: Trade[] }>(
    `/api/runners/${encodeURIComponent(agentId)}/trades?limit=${limit}`
  );
  return data.trades;
}

export async function getPortfolioLeaderboard(): Promise<AgentPerformance[]> {
  const data = await fetchAPI<{ leaderboard: AgentPerformance[] }>('/api/portfolio/leaderboard');
  return data.leaderboard;
}
