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

    return {
      volume,
      agents,
      trades24h,
      pnl: pnlCount > 0 ? pnlSum / pnlCount : 0,
    };
  }, [activities, agents]);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const pnlPositive = stats.pnl >= 0;
  const pnlColor    = pnlPositive ? T.color.green : T.color.red;

  const cells = [
    { label: 'NETWORK VOL',   value: fmt(stats.volume),       color: T.text.primary, glow: false },
    { label: 'ACTIVE AGENTS', value: String(stats.agents),    color: T.color.blue,   glow: false },
    { label: '24H TRADES',    value: String(stats.trades24h), color: T.text.primary, glow: false },
    {
      label: 'GLOBAL PNL',
      value: `${pnlPositive ? '+' : ''}${stats.pnl.toFixed(2)}%`,
      color: pnlColor,
      glow:  true,   // this value casts ambient light downward
    },
  ];

  return (
    // Etched header — no box borders, single bottom divider, P&L glow spills down
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        paddingBottom: '16px',
        // P&L ambient glow spills downward into the Ops Board below
        boxShadow: pnlPositive
          ? '0 12px 40px rgba(34,197,94,0.08), 0 6px 16px rgba(34,197,94,0.05)'
          : '0 12px 40px rgba(239,68,68,0.06)',
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          className="text-center"
          style={{
            padding: '12px 16px',
            // Thin separator between cells (no border on first)
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}
        >
          {/* Label — dimmed, all-caps monospace */}
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

          {/* Value — large bold mono, P&L gets text glow */}
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
  );
}
