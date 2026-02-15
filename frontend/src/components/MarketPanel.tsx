import { formatUsd } from '../lib/format';

interface Market {
  id: string;
  question: string;
  outcomePrices: number[];
  volume: number;
  liquidity: number;
}

interface Props {
  markets: Market[];
}

export default function MarketPanel({ markets }: Props) {
  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-white">📊 TOP MARKETS</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {markets.slice(0, 20).map((m) => {
          const yesPrice = m.outcomePrices?.[0] ?? 0.5;
          const pct = Math.min(yesPrice * 100, 100);

          return (
            <div key={m.id} className="px-4 py-3 border-b border-border hover:bg-white/5 transition-colors">
              <div className="text-xs text-white leading-snug mb-2">{m.question}</div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-success font-mono text-sm font-semibold tabular-nums">
                  YES {(yesPrice * 100).toFixed(0)}¢
                </span>
                <span className="text-text-muted text-[10px] font-mono">
                  Vol. {formatUsd(m.volume)}
                </span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {markets.length === 0 && (
          <div className="p-4 text-text-muted text-xs text-center">No markets</div>
        )}
      </div>
    </div>
  );
}
