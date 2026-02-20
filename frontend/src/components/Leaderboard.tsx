import { useState } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface LeaderboardProps {
  agents: any[];
  onSelectAgent: (agent: any) => void;
}

// Shared column layout — single source of truth
const COLS = '40px 1fr 88px 88px';
const GAP  = '8px';

// Multi-tier LED rank config
function getRankStyle(rank: number): { color: string; glow: string; label: string; size: string } {
  if (rank === 0) return {
    color: '#fbbf24',
    glow:  '0 0 4px #fbbf24, 0 0 10px rgba(251,191,36,0.8), 0 0 20px rgba(251,191,36,0.5)',
    label: '#1',
    size:  '15px',
  };
  if (rank === 1) return {
    color: '#e2e8f0',
    glow:  '0 0 8px rgba(226,232,240,0.6)',
    label: '#2',
    size:  '13px',
  };
  if (rank === 2) return {
    color: '#94a3b8',
    glow:  '0 0 8px rgba(226,232,240,0.6)',
    label: '#3',
    size:  '13px',
  };
  if (rank === 3) return {
    color: '#d97706',
    glow:  '0 0 8px rgba(217,119,6,0.4)',
    label: '#4',
    size:  '13px',
  };
  if (rank === 4) return {
    color: '#b45309',
    glow:  '0 0 8px rgba(217,119,6,0.4)',
    label: '#5',
    size:  '13px',
  };
  return { color: T.text.muted, glow: 'none', label: `#${rank + 1}`, size: '12px' };
}

function formatAum(equity: number): string {
  if (equity >= 1_000_000) return `$${(equity / 1_000_000).toFixed(2)}M`;
  if (equity >= 1_000)     return `$${(equity / 1_000).toFixed(1)}k`;
  return `$${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Single leaderboard row
function AgentRow({
  agent,
  rank,
  onSelectAgent,
}: {
  agent: any;
  rank: number;
  onSelectAgent: (a: any) => void;
}) {
  const rs     = getRankStyle(rank);
  const pnlPct = agent.totalPnlPct ?? 0;
  const pnlPos = pnlPct >= 0;
  const isTop  = rank === 0;

  // ROI pill — recessed P&L badge, white text per spec
  const pillBg   = pnlPos ? 'rgba(34,197,94,0.10)'  : 'rgba(239,68,68,0.10)';
  const pillBord = pnlPos ? 'rgba(34,197,94,0.30)'  : 'rgba(239,68,68,0.30)';

  return (
    <button
      onClick={() => onSelectAgent(agent)}
      className="w-full font-mono text-left rounded-sm px-3 py-2.5 transition-all"
      style={{
        display:             'grid',
        gridTemplateColumns: COLS,
        gap:                 GAP,
        alignItems:          'center',
        // Semi-transparent rows — blueprint grid bleeds through from page bg
        backgroundColor:     'rgba(5,5,5,0.8)',
        border:              `1px solid ${T.border.subtle}`,
        // Blueprint grid on EVERY row so it's always visible behind them
        backgroundImage:     T.grid.image,
        backgroundSize:      T.grid.size,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
        e.currentTarget.style.boxShadow   = '0 0 12px rgba(59,130,246,0.1)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border.subtle;
        e.currentTarget.style.boxShadow   = 'none';
      }}
    >
      {/* RANK — multi-tier LED glow */}
      <span
        className="font-bold font-mono shrink-0"
        style={{ fontSize: rs.size, color: rs.color, textShadow: rs.glow }}
      >
        {rs.label}
      </span>

      {/* AGENT NAME — medium-weight monospace */}
      <span
        className="truncate font-mono"
        style={{
          fontSize:   '12px',
          fontWeight: 500,
          color:      isTop ? T.text.primary : T.text.secondary,
        }}
      >
        {agent.agentName}
      </span>

      {/* ROI PILL — recessed P&L badge, white text */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span
          className="font-bold font-mono"
          style={{
            fontSize:        '11px',
            padding:         '2px 8px',
            borderRadius:    '2px',
            backgroundColor: pillBg,
            border:          `1px solid ${pillBord}`,
            color:           '#f4f4f5',   // white — high contrast P&L badge
            minWidth:        '58px',
            textAlign:       'right',
            display:         'inline-block',
          }}
        >
          {pnlPos ? '+' : ''}{pnlPct.toFixed(1)}%
        </span>
      </div>

      {/* AUM — Bold Monospace, Electric Blue */}
      <span
        className="font-mono"
        style={{ fontSize: '12px', fontWeight: 700, color: T.color.blue, textAlign: 'right' }}
      >
        {formatAum(agent.currentEquity ?? 0)}
      </span>
    </button>
  );
}

export function Leaderboard({ agents, onSelectAgent }: LeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!agents.length) return null;

  const PREVIEW_COUNT = 5;
  const visible = expanded ? agents : agents.slice(0, PREVIEW_COUNT);
  const hasMore  = agents.length > PREVIEW_COUNT;

  return (
    <section
      className="rounded-sm p-4"
      style={{
        border:          `1px solid ${T.border.DEFAULT}`,
        backgroundColor: 'rgba(5,5,5,0.6)',
      }}
    >
      {/* >_ AGENT LEADERBOARD */}
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: T.text.muted, fontSize: '13px', fontFamily: 'monospace' }}>
          &gt;_
        </span>
        <h2
          className="text-[13px] font-bold font-mono tracking-wide"
          style={{ color: T.text.primary }}
        >
          AGENT LEADERBOARD
        </h2>
        <span
          className="ml-auto font-mono text-[10px]"
          style={{ color: T.text.muted }}
        >
          {agents.length} agents
        </span>
      </div>

      {/* Column headers */}
      <div
        className="font-mono px-3 mb-1.5"
        style={{
          display:             'grid',
          gridTemplateColumns: COLS,
          gap:                 GAP,
          color:               T.text.muted,
          fontSize:            '9px',
          letterSpacing:       '0.12em',
        }}
      >
        <span>RANK</span>
        <span>AGENT</span>
        <span style={{ textAlign: 'right' }}>ROI</span>
        <span style={{ textAlign: 'right' }}>AUM</span>
      </div>

      {/* Rows — scrollable when expanded */}
      <div
        className="space-y-1.5"
        style={
          expanded
            ? {
                maxHeight:   '400px',
                overflowY:   'auto',
                paddingRight: '2px',
                // Electric Blue scrollbar
                scrollbarWidth: 'thin',
                scrollbarColor: `${T.color.blue} rgba(5,5,5,0.8)`,
              }
            : {}
        }
      >
        {visible.map((agent, i) => (
          <AgentRow
            key={agent.agentId}
            agent={agent}
            rank={i}
            onSelectAgent={onSelectAgent}
          />
        ))}
      </div>

      {/* [ VIEW ALL STRATEGIES ] / [ COLLAPSE ] toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 w-full font-bold font-mono text-[11px] py-2 rounded-sm transition-all tracking-widest"
          style={{
            border:          `1px solid ${T.color.blue}`,
            color:           T.color.blue,
            backgroundColor: 'rgba(59,130,246,0.06)',
            letterSpacing:   '0.1em',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.14)';
            e.currentTarget.style.boxShadow       = '0 0 14px rgba(59,130,246,0.35)';
            e.currentTarget.style.color            = '#60a5fa';
            e.currentTarget.style.textShadow       = '0 0 10px rgba(59,130,246,0.6)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.06)';
            e.currentTarget.style.boxShadow       = 'none';
            e.currentTarget.style.color            = '#3b82f6';
            e.currentTarget.style.textShadow       = 'none';
          }}
        >
          {expanded ? '[ COLLAPSE ]' : '[ VIEW ALL STRATEGIES ]'}
        </button>
      )}
    </section>
  );
}
