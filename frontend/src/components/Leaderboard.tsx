import { useState } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface LeaderboardProps {
  agents: any[];
  onSelectAgent: (agent: any) => void;
}

function getRankStyle(rank: number) {
  if (rank === 0) return {
    color: '#fbbf24',
    // FIX 4: Sharp white core → gold glow → wide amber halo
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

function AgentPod({ agent, rank, onSelectAgent }: {
  agent: any; rank: number; onSelectAgent: (a: any) => void;
}) {
  const rs     = getRankStyle(rank);
  const pnlPct = agent.totalPnlPct ?? 0;
  const pnlPos = pnlPct >= 0;

  return (
    // FIX 3: Fixed 220px width, no shrink — prevents pods crashing into each other
    <div style={{ position: 'relative', width: '220px', flexShrink: 0 }}>
      <button
        onClick={() => onSelectAgent(agent)}
        className="w-full text-left transition-all rounded-sm"
        style={{
          // FIX 1: Glass Floor — backdrop-blur-xl + bg-black/80
          // Blueprint grid distorts and dims behind the glass
          backgroundColor:      'rgba(0,0,0,0.82)',
          backdropFilter:       'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border:               `1px solid ${T.border.subtle}`,
          backgroundImage:      T.grid.imageSubtle,
          backgroundSize:       T.grid.size,
          padding:              '10px 14px 12px',
          display:              'flex',
          flexDirection:        'column',
          gap:                  '4px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.55)';
          e.currentTarget.style.boxShadow   = '0 0 18px rgba(59,130,246,0.14)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = T.border.subtle;
          e.currentTarget.style.boxShadow   = 'none';
        }}
      >
        {/* Rank + ROI */}
        <div className="flex items-center justify-between">
          <span className="font-bold font-mono"
            style={{ fontSize: '14px', color: rs.color, textShadow: rs.textShadow }}>
            {rs.label}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
            <span className="font-bold font-mono"
              style={{ fontSize: '8px', letterSpacing: '0.14em', color: T.text.muted, opacity: 0.3 }}>
              ROI
            </span>
            <span className="font-bold font-mono"
              style={{
                fontSize:        '10px',
                padding:         '2px 7px',
                borderRadius:    '2px',
                backgroundColor: pnlPos ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                border:          `1px solid ${pnlPos ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                color:           '#f4f4f5',
              }}>
              {pnlPos ? '+' : ''}{pnlPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Agent name — the star */}
        <div className="font-bold font-mono truncate"
          style={{ fontSize: '13px', color: '#f4f4f5', lineHeight: 1.2, paddingTop: '4px' }}>
          {agent.agentName}
        </div>

        {/* AUM */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', paddingTop: '2px' }}>
          <span className="font-bold font-mono"
            style={{ fontSize: '8px', letterSpacing: '0.14em', color: T.text.muted, opacity: 0.3 }}>
            AUM
          </span>
          <span className="font-bold font-mono"
            style={{ fontSize: '12px', color: T.color.blue }}>
            {formatAum(agent.currentEquity ?? 0)}
          </span>
        </div>
      </button>

      {/* FIX 2: Physical Wiring — solid 1px filament from pod center-bottom to OpsBoard top */}
      {/* height covers: 10px section padding + 1px border + 12px Dashboard gap + buffer */}
      <div
        aria-hidden
        style={{
          position:      'absolute',
          bottom:        '-40px',   // penetrates through section padding + gap + ops border
          left:          '50%',
          transform:     'translateX(-50%)',
          width:         '1px',
          height:        '40px',
          // Solid at top (at pod), fades to near-invisible at OpsBoard border
          background:    'linear-gradient(to bottom, rgba(59,130,246,0.85) 0%, rgba(59,130,246,0.4) 50%, rgba(59,130,246,0.05) 100%)',
          pointerEvents: 'none',
          zIndex:        20,
        }}
      />
    </div>
  );
}

export function Leaderboard({ agents, onSelectAgent }: LeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!agents.length) return null;

  const PREVIEW = 5;
  const visible = expanded ? agents : agents.slice(0, PREVIEW);
  const hasMore = agents.length > PREVIEW;

  return (
    // overflow:visible so filaments can extend below the section boundary
    <section
      style={{
        border:          `1px solid ${T.border.DEFAULT}`,
        backgroundColor: 'rgba(5,5,5,0.7)',
        backdropFilter:  'blur(8px)',
        padding:         '10px 14px',
        overflow:        'visible',
        position:        'relative',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: T.text.muted, fontSize: '13px', fontFamily: 'monospace' }}>&gt;_</span>
          <h2 className="font-bold font-mono text-[12px] tracking-widest uppercase"
            style={{ color: T.text.primary }}>
            Agent Leaderboard
          </h2>
          <span className="font-mono text-[10px]" style={{ color: T.text.muted, opacity: 0.5 }}>
            {agents.length} agents
          </span>
        </div>

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

      {/* FIX 3: Pod rail — overflow visible, no flex-wrap on first row */}
      <div
        style={{
          display:        'flex',
          gap:            '12px',
          alignItems:     'stretch',
          overflowX:      'auto',   // horizontal scroll if agents exceed viewport
          overflowY:      'visible',
          paddingBottom:  '40px',   // clearance for filament wires
          // Hide horizontal scrollbar — filaments are the UI, not scroll bars
          scrollbarWidth: 'none',
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

      {/* Expanded overflow — wraps below */}
      {expanded && agents.length > PREVIEW && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
          {agents.slice(PREVIEW).map((agent, i) => (
            <AgentPod
              key={agent.agentId}
              agent={agent}
              rank={PREVIEW + i}
              onSelectAgent={onSelectAgent}
            />
          ))}
        </div>
      )}
    </section>
  );
}
