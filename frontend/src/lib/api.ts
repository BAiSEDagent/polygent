const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

export const api = {
  getLeaderboard: () => get<any>('/leaderboard'),
  getActivity: (limit = 50) => get<any>(`/activity?limit=${limit}`),
  getRunners: () => get<any>('/runners'),
  getRunnerTrades: (id: string, limit = 50) => get<any>(`/runners/${id}/trades?limit=${limit}`),
  getStats: () => get<any>('/stats'),
  getMarkets: (limit = 50) => get<any>(`/markets?limit=${limit}&order=volume`),
  getPortfolio: () => get<any>('/portfolio'),
  getHealth: () => fetch('/health').then(r => r.json()),
};
