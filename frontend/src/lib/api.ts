const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  getLeaderboard: () => get<{ leaderboard: any[]; total: number }>('/leaderboard'),
  getActivity: (limit = 50) => get<{ activity: any[]; total: number }>(`/activity?limit=${limit}`),
  getRunners: () => get<{ agents: any[]; total: number }>('/runners'),
  getRunnerTrades: (id: string, limit = 50) => get<{ trades: any[]; total: number }>(`/runners/${id}/trades?limit=${limit}`),
  getStats: () => get<any>('/stats'),
  getMarkets: (limit = 50) => get<any>(`/markets?limit=${limit}&order=volume`),
  getPortfolio: () => get<any>('/portfolio'),
  getHealth: () => fetch('/health').then(r => r.json()),
};
