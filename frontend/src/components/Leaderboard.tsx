import { useState } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface LeaderboardProps {
  agents: any[];
  onSelectAgent: (agent: any) => void;
}

function getRankStyle(rank: number) {
  if (rank === 0) return {
    color: '#fbbf24',
    textShadow: '0 0 4px #fbbf24, 0 0 12px rgba(251,191,36,0.8), 0 0 28px rgba(251,191,36,0.5)',
    label: '#1',
  };
  if (rank === 1) return {
    color: '#e2e8f0',
    textShadow: '0 0 8px rgba(226,232,240,0.7), 0 0 18px rgba(226,232,240,0.4)',
    label: '#2',
  };
  if (rank === 2) return {
    color: '#94a3b8',
    textShadow: '0 0 8px rgba(148,163,184,0.7)',
    label: '#3',
  };
  if (rank === 3) return {
    color: '#d97706',
    textShadow: '0 0 8px rgba(217,119,6,0.6), 0 0 18px rgba(217,119,6,0.3)',
    label: '#4',
  };
  if (rank === 4) return {
    color: '#b45309',
    textShadow: '0 0 8px rgba(180,83,9,0.5)',
    label: '#5',
  };
  return { color: T.text.muted, textShadow: 'none', label: `#${rank + 1}` };
}

function formatAum(equity: number): string {
  if (equity >= 1_000_000) return `$${(equity / 1_000_000).toFixed(2)}M`;
  if (equity >= 1_000)     return `$${(equity / 1_000).toFixed(1)}k`;
  return `$${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function AgentPod({ agent, rank, onSelectAgent }: {
  agent: any; rank: number; onSelectAgent: (a: any) => void;
}) {
  const rs     = getRankStyle(rank);
  const pnlPct = agent.totalPnlPct ?? 0;
  const pnlPos = pnlPct >= 0;

  return (
    <button
      onClick={() => onSelectAgent(agent)}
      className="flex-1 text-left transition-all rounded-sm"
      style={{
        // Smoked glass pod
        backgroundColor:     'rgba(0,0,0,0.6)',
        backdropFilter:      'blur(12px)',
        WebkitBackdropFilter:'blur(12px)',
        border:              `1px solid ${T.border.subtle}`,
        backgroundImage:     T.grid.imageSubtle,
        backgroundSize:      T.grid.size,
        padding:             '10px 14px 12px',
        display:             'flex',
        flexDirection:       'column',
        gap:                 '6px',
        minWidth:            0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
        e.currentTarget.style.boxShadow   = '0 0 16px rgba(59,130,246,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border.subtle;
        e.currentTarget.style.boxShadow   = 'none';
      }}
    >
      {/* Top row: rank glyph + ROI pill */}
      <div className="flex items-center justify-between">
        <span
          className="font-bold font-mono"
          style={{ fontSize: '13px', color: rs.color, textShadow: rs.textShadow }}
        >
          {rs.label}
        </span>
        <span
          className="font-bold font-mono"
          style={{
            fontSize:        '10px',
            padding:         '2px 7px',
            borderRadius:    '2px',
            backgroundColor: pnlPos ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
            border:          `1px solid ${pnlPos ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
            color:           '#f4f4f5',
          }}
        >
          {pnlPos ? '+' : ''}{pnlPct.toFixed(1)}%
        </span>
      </div>

      {/* Agent name — white, bold monospace, fully visible */}
      <div
        className="font-bold font-mono truncate"
        style={{
          fontSize:   '13px',
          color:      '#f4f4f5',
          lineHeight: 1.2,
        }}
      >
        {agent.agentName}
      </div>

      {/* AUM — electric blue */}
      <div
        className="font-bold font-mono"
        style={{ fontSize: '12px', color: T.color.blue }}
      >
        {formatAum(agent.currentEquity ?? 0)}
      </div>
    </button>
  );
}

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
        backgroundColor: 'rgba(5,5,5,0.7)',
        backdropFilter:  'blur(8px)',
        padding:         '10px 14px',
      }}
    >
      {/* Header rail */}
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: '10px' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: T.text.muted, fontSize: '13px', fontFamily: 'monospace' }}>&gt;_</span>
          <h2
            className="font-bold font-mono text-[12px] tracking-widest uppercase"
            style={{ color: T.text.primary }}
          >
            Agent Leaderboard
          </h2>
          <span
            className="font-mono text-[10px]"
            style={{ color: T.text.muted, opacity: 0.5 }}
          >
            {agents.length} agents
          </span>
        </div>

        {/* Discovery tap — "More →" at far right */}
        {hasMore && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="font-mono font-bold text-[11px] transition-all"
            style={{
              color:       expanded ? T.text.muted : T.color.blue,
              letterSpacing: '0.06em',
            }}
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

      {/* Horizontal pod rail */}
      <div
        style={{
          display: 'flex',
          gap:     '10px',
          alignItems: 'stretch',
        }}
      >
        {visible.map((agent, i) => (
          <AgentPod
            key={agent.agentId}
            agent={agent}
            rank={i}
            onSelectAgent={onSelectAgent}
          />
        ))}
      </div>

      {/* Expanded overflow — wraps to second row if >5 */}
      {expanded && agents.length > PREVIEW && (
        <div
          style={{
            display:   'flex',
            flexWrap:  'wrap',
            gap:       '10px',
            marginTop: '10px',
          }}
        >
          {agents.slice(PREVIEW).map((agent, i) => (
            <div key={agent.agentId} style={{ flex: '1 1 180px', maxWidth: '240px' }}>
              <AgentPod
                agent={agent}
                rank={PREVIEW + i}
                onSelectAgent={onSelectAgent}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
