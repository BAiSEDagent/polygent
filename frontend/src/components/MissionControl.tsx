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
      if ((a.timestamp || 0) > cutoff && ['trade', 'execute', 'fill', 'paper_trade'].includes(a.type)) {
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
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const cells = [
    { label: 'NETWORK VOL', value: fmt(stats.volume), color: 'text-header' },
    { label: 'ACTIVE AGENTS', value: String(stats.agents), color: 'text-primary' },
    { label: '24H TRADES', value: String(stats.trades24h), color: 'text-header' },
    { label: 'GLOBAL PNL', value: `${stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)}%`, color: stats.pnl >= 0 ? 'text-success' : 'text-danger' },
  ];

  return (
    <div className="grid grid-cols-4 border border-border bg-surface/50 backdrop-blur-sm rounded-sm divide-x divide-border">
      {cells.map((c, i) => (
        <div key={i} className="px-6 py-4 text-center">
          <div className="text-[10px] text-muted uppercase tracking-[0.15em] mb-1.5">{c.label}</div>
          <div className={`text-3xl font-bold tracking-tight ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
