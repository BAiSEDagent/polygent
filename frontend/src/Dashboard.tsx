import { useState, useCallback } from 'react';
import { usePolling } from './hooks/usePolling';
import { useSimulation } from './hooks/useSimulation';
import { api } from './lib/api';
import { Header } from './components/Header';
import { MissionControl } from './components/MissionControl';
import { OpsBoard } from './components/OpsBoard';
import { IntelFeed } from './components/IntelFeed';
import { Leaderboard } from './components/Leaderboard';
import { AgentProfile } from './components/AgentProfile';

export function Dashboard() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  const healthFetch = useCallback(() => api.getHealth(), []);
  const lbFetch    = useCallback(() => api.getLeaderboard(), []);
  const actFetch   = useCallback(() => api.getActivity(100), []);

  const { data: health  } = usePolling(healthFetch, 5000);
  const { data: lbData  } = usePolling(lbFetch, 4000);
  const { data: actData } = usePolling(actFetch, 2000);

  const leaderboard    = lbData?.leaderboard ?? [];
  const realActivities = actData?.activity   ?? [];
  const activities     = useSimulation(realActivities, true);

  return (
    // Global blueprint grid across the entire page background
    <div
      className="min-h-screen font-mono"
      style={{
        backgroundColor: '#050505',
        backgroundImage:
          'linear-gradient(to right, rgba(100,116,139,0.1) 1px, transparent 1px), ' +
          'linear-gradient(to bottom, rgba(100,116,139,0.1) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        color: '#cbd5e1',
      }}
    >
      <Header
        wsConnected={health?.liveData?.wsConnected ?? false}
        marketsLoaded={health?.liveData?.marketsLoaded ?? 0}
        agents={health?.agents ?? 0}
      />

      <main className="p-4 lg:p-5 space-y-4">
        <MissionControl activities={activities} agents={health?.agents ?? 0} />

        <div className="grid grid-cols-1 xl:grid-cols-[2.2fr_1fr] gap-4 items-start">
          {/* Left column — scrolls with page */}
          <div className="space-y-4">
            <OpsBoard activities={activities} />
            <Leaderboard agents={leaderboard} onSelectAgent={setSelectedAgent} />
          </div>

          {/* Right column — Intel Feed, independently scrollable */}
          <div
            className="xl:sticky"
            style={{ top: '8px' }}
          >
            <IntelFeed activities={activities} />
          </div>
        </div>
      </main>

      {selectedAgent && (
        <AgentProfile agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}
