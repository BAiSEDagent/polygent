import { useState } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface LeaderboardProps {
  agents: any[];
  onSelectAgent: (agent: any) => void;
}

function getRankStyle(rank: number) {
  if (rank === 0) return {
    color: '#fbbf24',
    textShadow:
      '0 0 2px rgba(255,255,255,0.95), ' +
      '0 0 8px #fbbf24, ' +
      '0 0 20px rgba(251,191,36,0.75), ' +
      '0 0 48px rgba(217,119,6,0.40)',
    label: '#1',
  };
  if (rank === 1) return {
    color: '#e2e8f0',
    textShadow: '0 0 6px rgba(226,232,240,0.8), 0 0 16px rgba(226,232,240,0.35)',
    label: '#2',
  };
  if (rank === 2) return {
    color: '#94a3b8',
    textShadow: '0 0 6px rgba(148,163,184,0.6)',
    label: '#3',
  };
  if (rank === 3) return {
    color: '#d97706',
    textShadow: '0 0 8px rgba(217,119,6,0.7), 0 0 20px rgba(217,119,6,0.30)',
    label: '#4',
  };
  if (rank === 4) return {
    color: '#b45309',
    textShadow: '0 0 6px rgba(180,83,9,0.55)',
    label: '#5',
  };
  return { color: T.text.muted, textShadow: 'none', label: `#${rank + 1}` };
}

function formatAum(equity: number): string {
  if (equity >= 1_000_000) return `$${(equity / 1_000_000).toFixed(2)}M`;
  if (equity >= 1_000)     return `$${(equity / 1_000).toFixed(1)}k`;
  return `$${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ── THE BLADE — slim-line data strip, heavy glass mute ────────────────────────
function AgentRow({ agent, rank, onSelectAgent }: {
  agent: any; rank: number; onSelectAgent: (a: any) => void;
}) {
  const rs     = getRankStyle(rank);
  const pnlPct = agent.totalPnlPct ?? 0;
  const pnlPos = pnlPct >= 0;

  return (
    <button
      onClick={() => onSelectAgent(agent)}
      className="w-full rounded-sm transition-all"
      style={{
        // Heavy Glass Mute — grid barely visible, text pops
        backgroundColor:      'rgba(0,0,0,0.92)',
        backdropFilter:       'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        backgroundImage:      T.grid.imageSubtle,
        backgroundSize:       T.grid.size,
        border:               `1px solid ${T.border.subtle}`,
        // Slim-line density — py-2
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '8px 14px',   // py-2 equivalent, tight data strip
        gap:            '12px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.45)';
        e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.85)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border.subtle;
        e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.92)';
      }}
    >
      {/* LEFT — Rank + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <span
          className="font-bold font-mono shrink-0"
          style={{ fontSize: '13px', width: '26px', textAlign: 'left', color: rs.color, textShadow: rs.textShadow }}
        >
          {rs.label}
        </span>
        <span
          className="font-bold font-mono truncate"
          style={{ fontSize: '12px', color: '#f4f4f5' }}
        >
          {agent.agentName}
        </span>
      </div>

      {/* RIGHT — ROI pill + AUM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        {/* ROI — recessed pill */}
        <span
          className="font-bold font-mono"
          style={{
            fontSize:        '10px',
            padding:         '2px 8px',
            borderRadius:    '2px',
            backgroundColor: pnlPos ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
            border:          `1px solid ${pnlPos ? 'rgba(34,197,94,0.30)' : 'rgba(239,68,68,0.30)'}`,
            color:           '#f4f4f5',
            minWidth:        '58px',
            textAlign:       'right',
          }}
        >
          {pnlPos ? '+' : ''}{pnlPct.toFixed(1)}%
        </span>

        {/* AUM — label 30% opacity + Electric Blue value */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span
            className="font-mono"
            style={{ fontSize: '9px', letterSpacing: '0.12em', color: T.text.muted, opacity: 0.3 }}
          >
            AUM
          </span>
          <span
            className="font-bold font-mono"
            style={{ fontSize: '12px', color: T.color.blue, minWidth: '54px', textAlign: 'right' }}
          >
            {formatAum(agent.currentEquity ?? 0)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── THE SERVER RACK — Recessed Trench, snaps to OpsBoard width ────────────────
export function Leaderboard({ agents, onSelectAgent }: LeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!agents.length) return null;

  const PREVIEW = 5;
  const visible = expanded ? agents : agents.slice(0, PREVIEW);
  const hasMore = agents.length > PREVIEW;

  return (
    // Recessed Trench — inset shadow makes it look physically sunken into the dashboard
    <section
      style={{
        border:          `1px solid ${T.border.DEFAULT}`,
        backgroundColor: 'rgba(3,3,3,0.95)',
        // Recessed trench: multi-layer inset shadow for physical depth
        boxShadow:
          'inset 0 2px 20px rgba(0,0,0,0.90), ' +
          'inset 0 0 60px rgba(0,0,0,0.60), ' +
          'inset 0 1px 0 rgba(255,255,255,0.03)',
        padding: '8px 10px 10px',
      }}
    >
      {/* Header — minimal, aligned to OpsBoard aesthetic */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: `1px solid rgba(255,255,255,0.05)` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: T.text.muted, fontSize: '11px', fontFamily: 'monospace', opacity: 0.5 }}>&gt;_</span>
          <h2
            className="font-bold font-mono uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.16em', color: T.text.muted, opacity: 0.6 }}
          >
            Agent Leaderboard
          </h2>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: T.text.muted, opacity: 0.3 }}>
            {agents.length} agents
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.12em', color: T.text.muted, opacity: 0.3 }}>ROI</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '0.12em', color: T.text.muted, opacity: 0.3, minWidth: '72px', textAlign: 'right' }}>AUM</span>
          {hasMore && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="font-mono font-bold transition-all"
              style={{ fontSize: '10px', color: T.color.blue, letterSpacing: '0.08em' }}
              onMouseEnter={e => {
                e.currentTarget.style.textShadow = '0 0 10px rgba(59,130,246,0.7)';
                e.currentTarget.style.color = '#60a5fa';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.textShadow = 'none';
                e.currentTarget.style.color = T.color.blue;
              }}
            >
              {expanded ? '← LESS' : 'MORE →'}
            </button>
          )}
        </div>
      </div>

      {/* Blades — slim-line, gap-y-2 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {visible.map((agent, i) => (
          <AgentRow
            key={agent.agentId}
            agent={agent}
            rank={i}
            onSelectAgent={onSelectAgent}
          />
        ))}
      </div>
    </section>
  );
}
