import { useState, useCallback, useEffect } from 'react';
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

const SESSION_KEY = 'polygent_operator';

export function Dashboard() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [gridFlash,     setGridFlash]     = useState(false);
  // Seed initialAddress from sessionStorage — OperatorBridge handles its own linked state
  const [initialAddress] = useState<string>(() =>
    sessionStorage.getItem(SESSION_KEY) ?? ''
  );

  const healthFetch = useCallback(() => api.getHealth(), []);
  const lbFetch     = useCallback(() => api.getLeaderboard(), []);
  const actFetch    = useCallback(() => api.getActivity(100), []);

  const { data: health  } = usePolling(healthFetch, 5000);
  const { data: lbData  } = usePolling(lbFetch, 4000);
  const { data: actData } = usePolling(actFetch, 2000);

  const leaderboard    = lbData?.leaderboard ?? [];
  const realActivities = actData?.activity   ?? [];
  const activities     = useSimulation(realActivities, false);

  // Called by OperatorBridge when EOA link is established
  const handleOperatorConnected = (_address: string) => {
    // Fire Electric Blue grid pulse
    setGridFlash(true);
  };

  // Auto-clear flash after 800ms
  useEffect(() => {
    if (!gridFlash) return;
    const t = setTimeout(() => setGridFlash(false), 800);
    return () => clearTimeout(t);
  }, [gridFlash]);

  return (
    <>
      <style>{`
        /* Global grid pulse — Electric Blue flash across entire viewport on operator link */
        @keyframes grid-pulse-flash {
          0%   { opacity: 0; }
          12%  { opacity: 0.14; }
          40%  { opacity: 0.08; }
          100% { opacity: 0; }
        }
        .grid-flash-overlay {
          animation: grid-pulse-flash 0.8s ease-out forwards;
        }
      `}</style>

      <div
        className="min-h-screen font-mono"
        style={{
          position:        'relative',
          backgroundColor: '#050505',
          backgroundImage:
            'linear-gradient(to right, rgba(100,116,139,0.03) 1px, transparent 1px), ' +
            'linear-gradient(to bottom, rgba(100,116,139,0.03) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          color: '#cbd5e1',
        }}
      >
        {/* Vignette — always present */}
        <div aria-hidden style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.80) 100%)',
        }} />

        {/* ── GLOBAL GRID PULSE — Electric Blue flash on operator link ─── */}
        {gridFlash && (
          <div
            aria-hidden
            className="grid-flash-overlay"
            style={{
              position:        'fixed',
              inset:           0,
              pointerEvents:   'none',
              zIndex:          50,
              backgroundColor: '#3b82f6',
            }}
          />
        )}

        <Header
          wsConnected={health?.liveData?.wsConnected ?? false}
          marketsLoaded={health?.liveData?.marketsLoaded ?? 0}
          agents={health?.agents ?? 0}
        />

        <main className="p-4 lg:p-6" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          <MissionControl activities={activities} agents={health?.agents ?? 0} />

          <div style={{
            display:             'grid',
            gridTemplateColumns: '1fr 300px',
            gridTemplateRows:    'auto auto',
            gap:                 '12px',
            alignItems:          'start',
          }}>

            <Leaderboard agents={leaderboard} onSelectAgent={setSelectedAgent} />

            {/*
              ROW 1, COL 2 — OperatorBridge is ALWAYS mounted.
              It manages its own phases internally (idle → linking → linked).
              initialAddress restores persisted session from sessionStorage.
              Never conditionally unmount this — that's what caused the blank box.
            */}
            <OperatorBridge
              onConnect={handleOperatorConnected}
              initialAddress={initialAddress}
            />

            <OpsBoard activities={activities} />

            <div className="xl:sticky" style={{ top: '8px' }}>
              <IntelFeed activities={activities} />
            </div>

          </div>
        </main>

        {selectedAgent && (
          <AgentProfile agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
        )}
      </div>
    </>
  );
}
