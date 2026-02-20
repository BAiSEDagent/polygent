import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { time: string; value: number }[];
}

export default function PnLChart({ data }: Props) {
  // Stable mock data — only generated once when data is empty, not on every render
  const mockData = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => ({
      time: `${Math.floor(i / 2)}:${i % 2 === 0 ? '00' : '30'}`,
      value: 39800 + Math.random() * 200 + i * 10 + Math.sin(i / 3) * 100,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — stable for lifetime of component

  const chartData = data.length ? data : mockData;

  return (
    <div className="w-full h-full min-h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
          <Tooltip
            contentStyle={{ background: '#111318', border: '1px solid #1E2028', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#6B7280' }}
            formatter={(val: number) => [`$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Value']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3B82F6"
            strokeWidth={2}
            fill="url(#pnlGrad)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
