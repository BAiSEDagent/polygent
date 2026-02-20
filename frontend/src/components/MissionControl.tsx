import { useMemo } from 'react';

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

  const cells = [
    { label: 'NETWORK VOL',   value: fmt(stats.volume),     color: '#f4f4f5' },
    { label: 'ACTIVE AGENTS', value: String(stats.agents),  color: '#3b82f6' },
    { label: '24H TRADES',    value: String(stats.trades24h), color: '#f4f4f5' },
    {
      label: 'GLOBAL PNL',
      value: `${stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)}%`,
      color: stats.pnl >= 0 ? '#22c55e' : '#ef4444',
    },
  ];

  return (
    <div
      className="grid grid-cols-4 rounded-sm"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(15,15,16,0.5)',
        // Inline dividers via CSS: each cell except the first gets a left border
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          className="px-6 py-4 text-center"
          style={i > 0 ? { borderLeft: '1px solid rgba(255,255,255,0.08)' } : {}}
        >
          <div
            className="text-[10px] uppercase font-mono mb-1.5"
            style={{ color: '#71717a', letterSpacing: '0.15em' }}
          >
            {c.label}
          </div>
          <div
            className="text-3xl font-bold tracking-tight"
            style={{ color: c.color }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
