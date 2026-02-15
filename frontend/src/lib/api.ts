const BASE = '/api';

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const api = {
  getLeaderboard: () => get('/leaderboard'),
  getActivity: (limit = 100) => get(`/activity?limit=${limit}`),
  getMarkets: (limit = 20) => get(`/markets?limit=${limit}`),
  getPortfolio: () => get('/portfolio'),
  getHealth: () => fetch('/health').then(r => r.json()),
  getRunners: () => get('/agents'),
  getRunnerTrades: (id: string, limit = 100) => get(`/agents/${id}/trades?limit=${limit}`),
};
