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
    return `$${n.toLocaleString(undefined,{maximumFractionDigits:0})}`;
  };

  const pnlPos   = stats.pnl >= 0;
  const pnlColor = pnlPos ? T.color.green : T.color.red;

  const cells = [
    { label: 'NETWORK VOL',   value: fmt(stats.volume),       color: T.text.primary, energyBar: true,  glow: false },
    { label: 'ACTIVE AGENTS', value: String(stats.agents),    color: T.color.blue,   energyBar: false, glow: false },
    { label: '24H TRADES',    value: String(stats.trades24h), color: T.text.primary, energyBar: false, glow: false },
    { label: 'GLOBAL PNL',    value: `${pnlPos?'+':''}${stats.pnl.toFixed(2)}%`, color: pnlColor, energyBar: false, glow: true },
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

      {/* ── Unified Smoked Glass Rail ─────────────────────────────────────── */}
      <div
        style={{
          position:        'relative',
          display:         'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          // Single continuous smoked glass rail — all 4 cells share one glass floor
          backgroundColor:     'rgba(0,0,0,0.55)',
          backdropFilter:      'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          backgroundImage:     T.grid.imageSubtle,
          backgroundSize:      T.grid.size,
          boxShadow: pnlPos
            ? 'inset 0 2px 16px rgba(0,0,0,0.7), 0 12px 40px rgba(34,197,94,0.08)'
            : 'inset 0 2px 16px rgba(0,0,0,0.7), 0 12px 40px rgba(239,68,68,0.06)',
          borderBottom:    '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              position:   'relative',
              overflow:   'hidden',
              padding:    '14px 16px',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            {/* 1px Electric Blue Energy Bar on Network Vol only */}
            {c.energyBar && (
              <div
                className="stat-energy-bar"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: '1px', backgroundColor: T.color.blue,
                }}
              />
            )}

            {/* Label — top-left, 10px, bold mono, 30% opacity (ALL cells) */}
            <div
              className="font-bold font-mono"
              style={{
                fontSize:'10px', letterSpacing:'0.12em', textTransform:'uppercase',
                color: T.text.muted, opacity: 0.3, marginBottom: '8px',
              }}
            >
              {c.label}
            </div>

            {/* Value */}
            <div
              className="font-bold font-mono tracking-tight"
              style={{
                fontSize: '2.25rem', color: c.color, lineHeight: 1,
                textShadow: c.glow
                  ? pnlPos
                    ? '0 0 20px rgba(34,197,94,0.7),0 0 50px rgba(34,197,94,0.25)'
                    : '0 0 20px rgba(239,68,68,0.6),0 0 40px rgba(239,68,68,0.2)'
                  : 'none',
              }}
            >
              {c.value}
            </div>
          </div>
        ))}

        {/* ── Data Filament — 1px Blue/Indigo gradient dropping toward EXECUTING ── */}
        {/* Positioned at ~62% from left (center of 3rd column in 4-col ops board  */}
        {/* within the center 1fr of a [280px|1fr|300px] cockpit layout)            */}
        <div
          aria-hidden
          style={{
            position:   'absolute',
            bottom:     '-16px',
            // Target the EXECUTING column: offset 280px rail + (OpsBoard 3rd col of 4)
            // Approximated as 280px + ~62% of center = ~calc(280px + 62%) from page edge
            // Within MissionControl we position from left relative to this container:
            // OpsBoard start ≈ 280px + 16px gap = 296px from page left
            // EXECUTING col center ≈ 296px + (100% - 296px - 300px - 16px) * 0.625
            // Simpler: use left: 59% to visually target the executing column
            left:       '59%',
            width:      '1px',
            height:     '16px',
            background: 'linear-gradient(to bottom, rgba(99,102,241,0.9), rgba(59,130,246,0.0))',
            zIndex:     10,
          }}
        />
      </div>
    </>
  );
}
