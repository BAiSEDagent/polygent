import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface LeaderboardProps {
  agents: any[];
  onSelectAgent: (agent: any) => void;
}

// Shared column layout — single source so headers & rows are always in sync
const COLS = '40px 1fr 88px 88px';
const GAP  = '8px';

function getRankStyle(rank: number): { color: string; glow: string; label: string } {
  if (rank === 0) return {
    color: '#fbbf24',
    // LED filament effect — layered inner + outer glow
    glow:  '0 0 4px #fbbf24, 0 0 10px rgba(251,191,36,0.8), 0 0 20px rgba(251,191,36,0.5)',
    label: '#1',
  };
  if (rank === 1) return {
    color: '#94a3b8',
    glow:  '0 0 6px rgba(148,163,184,0.4)',
    label: '#2',
  };
  if (rank === 2) return {
    color: '#78909c',
    glow:  '0 0 4px rgba(120,144,156,0.3)',
    label: '#3',
  };
  return { color: T.text.muted, glow: 'none', label: `#${rank + 1}` };
}

export function Leaderboard({ agents, onSelectAgent }: LeaderboardProps) {
  if (!agents.length) return null;

  return (
    <section
      className="rounded-sm p-4"
      style={{
        border:          `1px solid ${T.border.DEFAULT}`,
        // Semi-transparent so global page grid bleeds through the section
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
      </div>

      {/* Column headers — same grid as rows */}
      <div
        className="font-mono px-3 mb-1"
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

      {/* Rows */}
      <div className="space-y-1.5">
        {agents.map((agent, rank) => {
          const rs       = getRankStyle(rank);
          const pnlPct   = agent.totalPnlPct ?? 0;
          const pnlPos   = pnlPct >= 0;
          const equity   = agent.currentEquity ?? 0;
          const isTop    = rank === 0;

          const pillBg   = pnlPos ? 'rgba(34,197,94,0.12)'  : 'rgba(239,68,68,0.12)';
          const pillBord = pnlPos ? 'rgba(34,197,94,0.35)'  : 'rgba(239,68,68,0.35)';
          const pillText = pnlPos ? T.color.green            : T.color.red;

          const aumFmt = equity >= 1_000_000
            ? `$${(equity / 1_000_000).toFixed(2)}M`
            : equity >= 1_000
              ? `$${(equity / 1_000).toFixed(1)}k`
              : `$${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

          return (
            <button
              key={agent.agentId}
              onClick={() => onSelectAgent(agent)}
              className="w-full font-mono text-left rounded-sm px-3 py-2.5 transition-all"
              style={{
                display:             'grid',
                gridTemplateColumns: COLS,
                gap:                 GAP,
                alignItems:          'center',
                // Rows at 80% opacity — lets the page blueprint grid bleed through
                backgroundColor:     'rgba(5,5,5,0.8)',
                border:              `1px solid ${T.border.subtle}`,
                // Blueprint grid ONLY on #1 row for visual hero treatment
                ...(isTop ? {
                  backgroundImage: T.grid.image,
                  backgroundSize:  T.grid.size,
                  backgroundBlendMode: 'normal',
                } : {}),
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
              {/* RANK — LED filament glow on #1 */}
              <span
                className="font-bold font-mono shrink-0"
                style={{
                  fontSize:   isTop ? '15px' : '13px',
                  color:      rs.color,
                  textShadow: rs.glow,
                }}
              >
                {rs.label}
              </span>

              {/* AGENT NAME */}
              <span
                className="truncate font-mono"
                style={{
                  fontSize: '12px',
                  color:    isTop ? T.text.primary : T.text.secondary,
                  fontWeight: isTop ? 700 : 400,
                }}
              >
                {agent.agentName}
              </span>

              {/* PNL PILL */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span
                  className="font-bold font-mono"
                  style={{
                    fontSize:        '11px',
                    padding:         '2px 8px',
                    borderRadius:    '2px',
                    backgroundColor: pillBg,
                    border:          `1px solid ${pillBord}`,
                    color:           pillText,
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
                style={{
                  fontSize:   '12px',
                  fontWeight: 700,
                  color:      T.color.blue,
                  textAlign:  'right',
                }}
              >
                {aumFmt}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
