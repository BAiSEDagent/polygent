import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';

interface Props {
  totalValue: number;
}

export default function PnLChart({ totalValue }: Props) {
  const data = useMemo(() => {
    const points = [];
    const base = totalValue || 40000;
    const now = Date.now();
    for (let i = 48; i >= 0; i--) {
      const noise = (Math.random() - 0.45) * base * 0.008;
      const trend = ((48 - i) / 48) * base * 0.006;
      points.push({
        time: new Date(now - i * 30 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: base + trend + noise,
      });
    }
    // Ensure last point matches actual value
    points[points.length - 1].value = base;
    return points;
  }, [totalValue]);

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} interval={11} />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#111318', border: '1px solid #1E2028', borderRadius: 4, fontSize: 12 }}
            labelStyle={{ color: '#6B7280' }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, 'Value']}
          />
          <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} fill="url(#chartGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
