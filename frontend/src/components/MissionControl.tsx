import { useMemo } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface MissionControlProps {
  activities: any[];
  agents: number;
}

export function MissionControl({ activities, agents }: MissionControlProps) {
  const stats = useMemo(() => {
    let volume = 0;
    let pnlSum = 0;
    let pnlCount = 0;
    let trades24h = 0;
    const cutoff = Date.now() - 86400000;

    for (const a of activities) {
      if (a.amount) volume += a.amount;
      if (a.pnl != null) { pnlSum += a.pnl; pnlCount++; }
      if (
        (a.timestamp || 0) > cutoff &&
        ['trade', 'execute', 'fill', 'paper_trade'].includes(a.type)
      ) {
        trades24h++;
      }
    }
    return { volume, agents, trades24h, pnl: pnlCount > 0 ? pnlSum / pnlCount : 0 };
  }, [activities, agents]);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const pnlPositive = stats.pnl >= 0;
  const pnlColor    = pnlPositive ? T.color.green : T.color.red;

  // Plain cells (ACTIVE AGENTS, 24H TRADES, GLOBAL PNL)
  const plainCells = [
    { label: 'ACTIVE AGENTS', value: String(stats.agents),    color: T.color.blue,   glow: false },
    { label: '24H TRADES',    value: String(stats.trades24h), color: T.text.primary, glow: false },
    {
      label: 'GLOBAL PNL',
      value: `${pnlPositive ? '+' : ''}${stats.pnl.toFixed(2)}%`,
      color: pnlColor,
      glow:  true,
    },
  ];

  return (
    <>
      {/* Energy bar pulse keyframe — matches breathing rails (3s) */}
      <style>{`
        @keyframes energy-pulse {
          0%, 100% { opacity: 0.35; box-shadow: 0 0 4px rgba(59,130,246,0.5); }
          50%       { opacity: 1.0;  box-shadow: 0 0 12px rgba(59,130,246,1.0), 0 0 24px rgba(59,130,246,0.4); }
        }
        .stat-energy-bar { animation: energy-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* Etched header — single bottom divider, P&L glow spills downward */}
      <div
        style={{
          display:       'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          borderBottom:  '1px solid rgba(255,255,255,0.10)',
          paddingBottom: '0',
          boxShadow: pnlPositive
            ? '0 12px 40px rgba(34,197,94,0.08), 0 6px 16px rgba(34,197,94,0.05)'
            : '0 12px 40px rgba(239,68,68,0.06)',
          alignItems: 'stretch',
        }}
      >
        {/* ── NETWORK VOL — Smoked Glass Bay ──────────────────────────── */}
        <div
          style={{
            position:        'relative',
            overflow:        'hidden',
            // Smoked glass treatment
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter:  'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            // Blueprint grid refracts behind the glass
            backgroundImage: T.grid.imageSubtle,
            backgroundSize:  T.grid.size,
            // Recessed inner shadow
            boxShadow:       'inset 0 2px 12px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)',
            padding:         '14px 16px 14px 16px',
            borderRight:     '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* 1px Electric Blue Energy Bar — breathes every 3s */}
          <div
            className="stat-energy-bar"
            style={{
              position:        'absolute',
              top:             0,
              left:            0,
              right:           0,
              height:          '1px',
              backgroundColor: T.color.blue,
            }}
          />

          {/* Label — top-left, 10px, bold mono, 30% opacity */}
          <div
            className="font-bold font-mono"
            style={{
              fontSize:      '10px',
              letterSpacing: '0.12em',
              color:         T.text.muted,
              opacity:       0.3,
              marginBottom:  '8px',
              textTransform: 'uppercase',
            }}
          >
            NETWORK VOL
          </div>

          {/* Value — large, full weight */}
          <div
            className="font-bold font-mono tracking-tight"
            style={{ fontSize: '2.25rem', color: T.text.primary, lineHeight: 1 }}
          >
            {fmt(stats.volume)}
          </div>
        </div>

        {/* ── PLAIN CELLS: ACTIVE AGENTS · 24H TRADES · GLOBAL PNL ──── */}
        {plainCells.map((c, i) => (
          <div
            key={i}
            className="text-center"
            style={{
              padding:     '14px 16px',
              borderLeft:  '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* Label — dimmed */}
            <div
              className="font-mono uppercase"
              style={{
                color:         T.text.muted,
                opacity:       0.5,
                fontSize:      '9px',
                letterSpacing: '0.18em',
                marginBottom:  '6px',
              }}
            >
              {c.label}
            </div>

            {/* Value — P&L gets projected text glow */}
            <div
              className="font-bold font-mono tracking-tight"
              style={{
                fontSize:   '2.25rem',
                color:      c.color,
                lineHeight: 1,
                textShadow: c.glow
                  ? pnlPositive
                    ? '0 0 20px rgba(34,197,94,0.7), 0 0 50px rgba(34,197,94,0.25)'
                    : '0 0 20px rgba(239,68,68,0.6), 0 0 40px rgba(239,68,68,0.2)'
                  : 'none',
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
