import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PnLChartProps {
  pnl: {
    deposited: number;
    currentEquity: number;
    totalPnL: number;
    totalPnLPct: number;
    realizedPnL: number;
    unrealizedPnL: number;
  };
  trades: any[];
}

export function PnLChart({ pnl, trades }: PnLChartProps) {
  // Generate equity curve from trades
  const chartData = [
    { timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, equity: pnl.deposited },
    ...trades
      .slice()
      .reverse()
      .reduce((acc, trade, i) => {
        const prev = acc[acc.length - 1]?.equity ?? pnl.deposited;
        // Simple P&L calc — real implementation needs position tracking
        const pnlDelta = trade.side === 'SELL' ? trade.notional * 0.02 : -trade.notional * 0.01;
        acc.push({
          timestamp: trade.timestamp * 1000,
          equity: prev + pnlDelta,
        });
        return acc;
      }, [] as { timestamp: number; equity: number }[]),
    { timestamp: Date.now(), equity: pnl.currentEquity },
  ];

  const isProfit = pnl.totalPnL >= 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-zinc-100">Performance</h2>
        <div className="flex gap-6 text-sm">
          <div>
            <div className="text-zinc-500 text-xs">Realized P&L</div>
            <div className={`font-semibold ${pnl.realizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl.realizedPnL >= 0 ? '+' : ''}${pnl.realizedPnL.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs">Unrealized P&L</div>
            <div className={`font-semibold ${pnl.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl.unrealizedPnL >= 0 ? '+' : ''}${pnl.unrealizedPnL.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            stroke="#52525b"
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            stroke="#52525b"
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickLine={false}
            tickFormatter={(val) => `$${val.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
            labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
          />
          <Line
            type="monotone"
            dataKey="equity"
            stroke={isProfit ? '#10b981' : '#ef4444'}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
