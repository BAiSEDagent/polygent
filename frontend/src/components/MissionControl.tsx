import { useMemo } from 'react';
import { INDUSTRIAL_THEME as T } from '../lib/theme';

interface MissionControlProps {
  activities: any[];
  agents: number;
}

export function MissionControl({ activities, agents }: MissionControlProps) {
  const stats = useMemo(() => {
    let volume = 0, pnlSum = 0, pnlCount = 0, trades24h = 0;
    const cutoff = Date.now() - 86400000;
    for (const a of activities) {
      if (a.amount) volume += a.amount;
      if (a.pnl != null) { pnlSum += a.pnl; pnlCount++; }
      if ((a.timestamp || 0) > cutoff && ['trade','execute','fill','paper_trade'].includes(a.type)) trades24h++;
    }
    return { volume, agents, trades24h, pnl: pnlCount > 0 ? pnlSum / pnlCount : 0 };
  }, [activities, agents]);

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `$${(n/1_000).toFixed(1)}k`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const pnlPos   = stats.pnl >= 0;
  const pnlColor = pnlPos ? T.color.green : T.color.red;

  const cells = [
    { label: 'NETWORK VOL',   value: fmt(stats.volume),       color: T.text.primary, energyBar: true,  glow: false },
    { label: 'ACTIVE AGENTS', value: String(stats.agents),    color: T.color.blue,   energyBar: false, glow: false },
    { label: '24H TRADES',    value: String(stats.trades24h), color: T.text.primary, energyBar: false, glow: false },
    {
      label: 'GLOBAL PNL',
      value: `${pnlPos ? '+' : ''}${stats.pnl.toFixed(2)}%`,
      color: pnlColor, energyBar: false, glow: true,
    },
  ];

  return (
    <>
      <style>{`
        @keyframes energy-pulse {
          0%,100% { opacity:0.35; box-shadow:0 0 4px rgba(59,130,246,0.5); }
          50%      { opacity:1.0;  box-shadow:0 0 12px rgba(59,130,246,1.0),0 0 24px rgba(59,130,246,0.4); }
        }
        .stat-energy-bar { animation: energy-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* ── Solid Black Hardware Rail ─────────────────────────────────────── */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          backgroundColor:     '#050505',           // solid black bar
          borderBottom:        '1px solid rgba(255,255,255,0.10)',
          // P&L ambient glow spills downward
          boxShadow: pnlPos
            ? '0 8px 30px rgba(34,197,94,0.07)'
            : '0 8px 30px rgba(239,68,68,0.05)',
          position: 'relative',
        }}
      >
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              position:   'relative',
              overflow:   'hidden',
              // Etched divider between each module bay
              borderRight: i < cells.length - 1
                ? '1px solid rgba(255,255,255,0.10)'
                : 'none',
              // Inner depth — numbers sit inside a recessed slot
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)',
              // Flex column: label top-left, value centered
              display:        'flex',
              flexDirection:  'column',
              minHeight:      '88px',
              padding:        '10px 16px 12px',
            }}
          >
            {/* 1px Electric Blue Energy Bar — Network Vol only */}
            {c.energyBar && (
              <div
                className="stat-energy-bar"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: '1px', backgroundColor: T.color.blue,
                }}
              />
            )}

            {/* Label — top-left, 10px, bold mono, 30% opacity */}
            <div
              className="font-bold font-mono shrink-0"
              style={{
                fontSize:      '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         T.text.muted,
                opacity:       0.3,
              }}
            >
              {c.label}
            </div>

            {/* Value — centered in the remaining bay space */}
            <div
              style={{
                flex:           1,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}
            >
              <div
                className="font-bold font-mono tracking-tight"
                style={{
                  fontSize:   '2rem',
                  color:      c.color,
                  lineHeight: 1,
                  textShadow: c.glow
                    ? pnlPos
                      ? '0 0 20px rgba(34,197,94,0.7), 0 0 50px rgba(34,197,94,0.25)'
                      : '0 0 20px rgba(239,68,68,0.6), 0 0 40px rgba(239,68,68,0.2)'
                    : 'none',
                }}
              >
                {c.value}
              </div>
            </div>
          </div>
        ))}

        {/* Data Filament — drops from stats rail toward EXECUTING column */}
        <div
          aria-hidden
          style={{
            position:   'absolute',
            bottom:     '-16px',
            left:       '59%',
            width:      '1px',
            height:     '16px',
            background: 'linear-gradient(to bottom, rgba(99,102,241,0.9), transparent)',
            zIndex:     10,
          }}
        />
      </div>
    </>
  );
}
