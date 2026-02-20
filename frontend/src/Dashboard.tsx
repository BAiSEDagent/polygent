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
import { OperatorBridge } from './components/OperatorBridge';

export function Dashboard() {
  const [selectedAgent,  setSelectedAgent]  = useState<any>(null);
  const [bridgeVisible,  setBridgeVisible]  = useState(true);

  const healthFetch = useCallback(() => api.getHealth(), []);
  const lbFetch     = useCallback(() => api.getLeaderboard(), []);
  const actFetch    = useCallback(() => api.getActivity(100), []);

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
          'linear-gradient(to right, rgba(100,116,139,0.03) 1px, transparent 1px), ' +
          'linear-gradient(to bottom, rgba(100,116,139,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        color: '#cbd5e1',
      }}
    >
      {/* Vignette depth — center bright, edges absorb into void */}
      <div
        aria-hidden
        style={{
          position:      'fixed',
          inset:         0,
          pointerEvents: 'none',
          zIndex:        0,
          background:    'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.80) 100%)',
        }}
      />
      <Header
        wsConnected={health?.liveData?.wsConnected ?? false}
        marketsLoaded={health?.liveData?.marketsLoaded ?? 0}
        agents={health?.agents ?? 0}
      />

      <main className="p-4 lg:p-6" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── TIER 1: Global Stats Rail — full width ─────────────────────── */}
        <MissionControl activities={activities} agents={health?.agents ?? 0} />

        {/* ── TIER 2 + 3: Shared 2-col grid (1fr | 300px) ───────────────── */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1fr 300px',
            gridTemplateRows:    'auto auto',
            gap:                 '12px',
            alignItems:          'start',
          }}
        >
          {/* ROW 1, COL 1 — Leaderboard */}
          <Leaderboard agents={leaderboard} onSelectAgent={setSelectedAgent} />

          {/* ROW 1, COL 2 — Operator Bridge (hidden after init sequence completes) */}
          {bridgeVisible
            ? <OperatorBridge onConnect={() => setBridgeVisible(false)} />
            : <div />   /* void — keeps grid intact after bridge dismisses */
          }

          {/* ROW 2, COL 1 — Live Operations Board */}
          <OpsBoard activities={activities} />

          {/* ROW 2, COL 2 — Intel Feed, sticky */}
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
