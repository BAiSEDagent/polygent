import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: Array<{ timestamp: number; equity: number }>;
  height?: number;
}

export default function PnLChart({ data, height = 200 }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center border border-border bg-surface" style={{ height }}>
        <span className="text-text-muted font-mono text-xs">No equity data yet</span>
      </div>
    );
  }

  return (
    <div className="border border-border bg-surface p-2" style={{ height: height + 16 }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D395" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00D395" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            tick={{ fill: '#555566', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: '#1E1E2E' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#555566', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}K`}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: '#12121A',
              border: '1px solid #1E1E2E',
              borderRadius: '2px',
              fontFamily: 'JetBrains Mono',
              fontSize: 11,
            }}
            labelFormatter={(v) => new Date(v).toLocaleString()}
            formatter={(v: number) => [`$${v.toFixed(2)}`, 'Equity']}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#00D395"
            fill="url(#pnlGrad)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
