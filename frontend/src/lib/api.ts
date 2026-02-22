const BASE = import.meta.env.VITE_API_URL || '/api';

async function get(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

const health = () => {
  const healthBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '';
  return fetch(`${healthBase}/health`).then(r => r.json());
};

export const api = {
  getLeaderboard: () => get('/leaderboard'),
  getActivity: (limit = 100) => get(`/activity?limit=${limit}`),
  getMarkets: (limit = 20) => get(`/markets?limit=${limit}`),
  getPortfolio: () => get('/portfolio'),
  getHealth: health,
  getRunners: () => get('/agents'),
  getRunnerTrades: (id: string, limit = 100) => get(`/agents/${id}/trades?limit=${limit}`),
};
