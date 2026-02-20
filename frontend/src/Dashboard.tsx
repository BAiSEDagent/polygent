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

export function Dashboard() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [bridgeVisible, setBridgeVisible] = useState(true);
  const [gridFlash,     setGridFlash]     = useState(false);  // 0.8s blue pulse
  const [voidScan,      setVoidScan]      = useState(false);  // 3s placeholder scan

  const healthFetch = useCallback(() => api.getHealth(), []);
  const lbFetch     = useCallback(() => api.getLeaderboard(), []);
  const actFetch    = useCallback(() => api.getActivity(100), []);

  const { data: health  } = usePolling(healthFetch, 5000);
  const { data: lbData  } = usePolling(lbFetch, 4000);
  const { data: actData } = usePolling(actFetch, 2000);

  const leaderboard    = lbData?.leaderboard ?? [];
  const realActivities = actData?.activity   ?? [];
  const activities     = useSimulation(realActivities, true);

  const handleOperatorConnected = (_address: string) => {
    setBridgeVisible(false);
    // Trigger global Electric Blue grid pulse
    setGridFlash(true);
    setVoidScan(true);
  };

  // Auto-clear flash after 800ms
  useEffect(() => {
    if (!gridFlash) return;
    const t = setTimeout(() => setGridFlash(false), 800);
    return () => clearTimeout(t);
  }, [gridFlash]);

  // Auto-clear void scan after 3000ms
  useEffect(() => {
    if (!voidScan) return;
    const t = setTimeout(() => setVoidScan(false), 3000);
    return () => clearTimeout(t);
  }, [voidScan]);

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

        /* Void scan line — placeholder after bridge dismisses, 3s single pass */
        @keyframes void-scan-line {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 0.55; }
          92%  { opacity: 0.55; }
          100% { top: 100%; opacity: 0; }
        }
        .void-scan-line {
          position: absolute;
          left: 0; right: 0; height: 1px;
          background: linear-gradient(
            to right,
            transparent 0%,
            rgba(59,130,246,0.5) 30%,
            rgba(59,130,246,0.5) 70%,
            transparent 100%
          );
          animation: void-scan-line 3s linear forwards;
          pointer-events: none;
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

            {/* ROW 1, COL 2 — Bridge or void */}
            {bridgeVisible
              ? <OperatorBridge onConnect={handleOperatorConnected} />
              : (
                  // Void placeholder — maintains grid slot, shows power-up scan for 3s
                  <div style={{
                    position: 'relative',
                    overflow: 'hidden',
                    // Faint border so the slot isn't completely invisible
                    border:          'none',
                    backgroundColor: 'transparent',
                    minHeight:       '20px',
                  }}>
                    {voidScan && <div className="void-scan-line" />}
                  </div>
                )
            }

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
