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

      <main className="p-4 lg:p-6" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── TIER 1: Global Stats Rail — full width ─────────────────────── */}
        <MissionControl activities={activities} agents={health?.agents ?? 0} />

        {/* ── TIER 2 + 3: Shared 2-col grid (1fr | 300px) ───────────────── */}
        {/* Leaderboard snaps to OpsBoard width exactly; Intel Feed column    */}
        {/* stays empty above itself — no spanning, pure alignment            */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1fr 300px',
            gridTemplateRows:    'auto auto',
            gap:                 '12px',
            alignItems:          'start',
          }}
        >
          {/* ROW 1, COL 1 — Leaderboard: width = OpsBoard width exactly */}
          <Leaderboard agents={leaderboard} onSelectAgent={setSelectedAgent} />

          {/* ROW 1, COL 2 — Empty: space above Intel Feed is void */}
          <div />

          {/* ROW 2, COL 1 — Live Operations Board */}
          <OpsBoard activities={activities} />

          {/* ROW 2, COL 2 — Intel Feed, sticky. Starts at OpsBoard level. Space above = void. */}
          <div className="xl:sticky" style={{ top: '8px' }}>
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
