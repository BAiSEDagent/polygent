import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface LeaderboardProps {
  agents: any[];
  onSelectAgent: (agent: any) => void;
}

// Rank color + glow config
function getRankStyle(rank: number): { color: string; glow: string; label: string } {
  if (rank === 0) return {
    color: '#fbbf24',                              // Neon Gold
    glow:  '0 0 8px rgba(251,191,36,0.6)',
    label: '#1',
  };
  if (rank === 1) return {
    color: '#94a3b8',                              // Slate Silver
    glow:  '0 0 5px rgba(148,163,184,0.3)',
    label: '#2',
  };
  if (rank === 2) return {
    color: '#78909c',                              // Dimmer silver
    glow:  '0 0 4px rgba(120,144,156,0.25)',
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
        backgroundColor: 'rgba(15,15,16,0.5)',
      }}
    >
      {/* >_ AGENT LEADERBOARD header */}
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

      {/* Column labels */}
      <div
        className="grid items-center mb-1.5 px-3 font-mono"
        style={{
          gridTemplateColumns: '36px 1fr 90px 90px',
          gap: '12px',
          color: T.text.muted,
          fontSize: '9px',
          letterSpacing: '0.12em',
        }}
      >
        <span>RANK</span>
        <span>AGENT</span>
        <span className="text-right">ROI</span>
        <span className="text-right">AUM</span>
      </div>

      {/* Ranking rows */}
      <div className="space-y-1.5">
        {agents.map((agent, rank) => {
          const rankStyle  = getRankStyle(rank);
          const pnlPct     = agent.totalPnlPct ?? 0;
          const pnlPos     = pnlPct >= 0;
          const equity     = agent.currentEquity ?? 0;
          const isTopAgent = rank === 0;

          // PNL pill colors
          const pillBg   = pnlPos ? 'rgba(34,197,94,0.12)'  : 'rgba(239,68,68,0.12)';
          const pillBord = pnlPos ? 'rgba(34,197,94,0.3)'   : 'rgba(239,68,68,0.3)';
          const pillText = pnlPos ? T.color.green            : T.color.red;

          return (
            <button
              key={agent.agentId}
              onClick={() => onSelectAgent(agent)}
              className="grid w-full items-center font-mono text-left rounded-sm px-3 py-2.5 transition-all"
              style={{
                gridTemplateColumns: '36px 1fr 90px 90px',
                gap: '12px',
                // Recessed solid black row
                backgroundColor: '#050505',
                border: `1px solid ${T.border.subtle}`,
                // Blueprint grid ONLY on #1 row
                ...(isTopAgent ? {
                  backgroundImage: T.grid.image,
                  backgroundSize:  T.grid.size,
                } : {}),
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)';
                e.currentTarget.style.boxShadow   = '0 0 12px rgba(59,130,246,0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = T.border.subtle;
                e.currentTarget.style.boxShadow   = 'none';
              }}
            >
              {/* RANK — hero number with glow */}
              <span
                className="font-bold text-[13px] font-mono shrink-0"
                style={{
                  color:      rankStyle.color,
                  textShadow: rankStyle.glow,
                }}
              >
                {rankStyle.label}
              </span>

              {/* AGENT NAME */}
              <span
                className="truncate text-[12px] font-mono"
                style={{ color: isTopAgent ? T.text.primary : T.text.secondary }}
              >
                {agent.agentName}
              </span>

              {/* PNL PILL */}
              <div className="flex justify-end">
                <span
                  className="font-bold font-mono text-[11px] px-2 py-0.5 rounded-sm"
                  style={{
                    backgroundColor: pillBg,
                    border:          `1px solid ${pillBord}`,
                    color:           pillText,
                    minWidth:        '60px',
                    textAlign:       'right',
                    display:         'inline-block',
                  }}
                >
                  {pnlPos ? '+' : ''}{pnlPct.toFixed(1)}%
                </span>
              </div>

              {/* AUM — Electric Blue */}
              <span
                className="text-right font-bold font-mono text-[11px]"
                style={{ color: T.color.blue }}
              >
                {equity >= 1000
                  ? `$${(equity / 1000).toFixed(1)}k`
                  : `$${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
