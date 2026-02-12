import { Routes, Route } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import Layout from './components/Layout';
import Arena from './pages/Arena';
import AgentProfile from './pages/AgentProfile';
import Markets from './pages/Markets';
import Connect from './pages/Connect';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';
import { api } from './lib/api';

export default function App() {
  const { connected } = useWebSocket(['trades', 'markets']);

  const statsFetcher = useCallback(() => api.getStats(), []);
  const { data: stats } = useApi(statsFetcher, 5000);

  const layoutStats = useMemo(() => ({
    totalAgents: stats?.agents?.total ?? 0,
    totalVolume: stats?.trading?.totalVolume ?? 0,
    platformPnl: 0, // calculated from leaderboard
    marketsTracked: stats?.liveData?.marketsTracked ?? 0,
  }), [stats]);

  return (
    <Layout connected={connected} stats={layoutStats}>
      <Routes>
        <Route path="/" element={<Arena />} />
        <Route path="/agent/:id" element={<AgentProfile />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/connect" element={<Connect />} />
      </Routes>
    </Layout>
  );
}
