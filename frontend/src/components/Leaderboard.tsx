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

// ── THE BLADE ─────────────────────────────────────────────────────────────────
// Full-width horizontal row, smoked glass, blueprint grid refracting through
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
        // Smoked Glass — bg-black/60 + backdrop-blur-md + blueprint grid refracts through
        backgroundColor:      'rgba(0,0,0,0.60)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        backgroundImage:      T.grid.imageSubtle,
        backgroundSize:       T.grid.size,
        border:               `1px solid ${T.border.subtle}`,
        // Row layout
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 16px',
        gap:            '12px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.45)';
        e.currentTarget.style.boxShadow   = '0 0 14px rgba(59,130,246,0.10)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border.subtle;
        e.currentTarget.style.boxShadow   = 'none';
      }}
    >
      {/* LEFT — Rank glyph + Agent Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        {/* Rank — triple-layer tier glow */}
        <span
          className="font-bold font-mono shrink-0"
          style={{ fontSize: '14px', width: '28px', textAlign: 'left', color: rs.color, textShadow: rs.textShadow }}
        >
          {rs.label}
        </span>

        {/* Agent Name — white, bold monospace, the star */}
        <span
          className="font-bold font-mono truncate"
          style={{ fontSize: '13px', color: '#f4f4f5' }}
        >
          {agent.agentName}
        </span>
      </div>

      {/* RIGHT — ROI pill + AUM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>

        {/* ROI — recessed pill (bg-opacity-10, border-opacity-30) */}
        <span
          className="font-bold font-mono"
          style={{
            fontSize:        '11px',
            padding:         '3px 10px',
            borderRadius:    '2px',
            backgroundColor: pnlPos ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
            border:          `1px solid ${pnlPos ? 'rgba(34,197,94,0.30)' : 'rgba(239,68,68,0.30)'}`,
            color:           '#f4f4f5',
            minWidth:        '64px',
            textAlign:       'right',
          }}
        >
          {pnlPos ? '+' : ''}{pnlPct.toFixed(1)}%
        </span>

        {/* AUM — label dimmed 30%, value in electric blue */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
          <span
            className="font-bold font-mono"
            style={{ fontSize: '10px', letterSpacing: '0.12em', color: T.text.muted, opacity: 0.3 }}
          >
            AUM
          </span>
          <span
            className="font-bold font-mono"
            style={{ fontSize: '13px', color: T.color.blue }}
          >
            {formatAum(agent.currentEquity ?? 0)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── THE SERVER RACK ────────────────────────────────────────────────────────────
export function Leaderboard({ agents, onSelectAgent }: LeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!agents.length) return null;

  const PREVIEW = 5;
  const visible = expanded ? agents : agents.slice(0, PREVIEW);
  const hasMore = agents.length > PREVIEW;

  return (
    <section
      style={{
        border:          `1px solid ${T.border.DEFAULT}`,
        backgroundColor: 'rgba(5,5,5,0.75)',
        padding:         '10px 14px 12px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: `1px solid ${T.border.subtle}` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: T.text.muted, fontSize: '13px', fontFamily: 'monospace' }}>&gt;_</span>
          <h2
            className="font-bold font-mono text-[12px] tracking-widest uppercase"
            style={{ color: T.text.primary }}
          >
            Agent Leaderboard
          </h2>
          <span className="font-mono text-[10px]" style={{ color: T.text.muted, opacity: 0.5 }}>
            {agents.length} agents
          </span>
        </div>

        {/* Column labels */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.14em', color: T.text.muted, opacity: 0.35 }}>ROI</span>
          <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.14em', color: T.text.muted, opacity: 0.35, minWidth: '80px', textAlign: 'right' }}>AUM</span>
          {hasMore && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="font-mono font-bold text-[11px] transition-all"
              style={{ color: expanded ? T.text.muted : T.color.blue, letterSpacing: '0.06em' }}
              onMouseEnter={e => {
                e.currentTarget.style.textShadow = '0 0 10px rgba(59,130,246,0.7)';
                e.currentTarget.style.color = '#60a5fa';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.textShadow = 'none';
                e.currentTarget.style.color = expanded ? T.text.muted : T.color.blue;
              }}
            >
              {expanded ? '← LESS' : 'MORE →'}
            </button>
          )}
        </div>
      </div>

      {/* THE BLADES — vertical server rack, gap-y-2 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
