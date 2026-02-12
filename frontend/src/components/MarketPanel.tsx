import SparkLine from './SparkLine';
import { formatUsd, truncate } from '../lib/format';

interface MarketData {
  id: string;
  question: string;
  outcomePrices: number[];
  volume: number;
  liquidity: number;
  active: boolean;
}

interface Props {
  markets: MarketData[];
}

export default function MarketPanel({ markets }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Market Intelligence
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {markets.slice(0, 15).map((m) => {
          const yesPrice = m.outcomePrices?.[0] ?? 0.5;
          const noPrice = m.outcomePrices?.[1] ?? 0.5;
          // Generate synthetic sparkline data from price
          const spark = Array.from({ length: 12 }, (_, i) =>
            yesPrice + (Math.random() - 0.5) * 0.06 * Math.sin(i * 0.5)
          );

          return (
            <div
              key={m.id}
              className="px-3 py-2.5 border-b border-border/30 hover:bg-surface/80 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-text-primary leading-tight flex-1">
                  {truncate(m.question, 65)}
                </p>
                <SparkLine data={spark} color="auto" width={60} height={20} />
              </div>

              {/* Price bar */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 bg-border overflow-hidden flex">
                  <div
                    className="h-full bg-success"
                    style={{ width: `${yesPrice * 100}%` }}
                  />
                  <div
                    className="h-full bg-danger"
                    style={{ width: `${noPrice * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-success">
                    YES {(yesPrice * 100).toFixed(0)}¢
                  </span>
                  <span className="text-[10px] font-mono text-danger">
                    NO {(noPrice * 100).toFixed(0)}¢
                  </span>
                </div>
                <span className="text-[10px] font-mono text-text-muted">
                  Vol {formatUsd(m.volume)}
                </span>
              </div>
            </div>
          );
        })}
        {markets.length === 0 && (
          <div className="p-8 text-center text-text-muted text-xs font-mono">
            Loading markets...
          </div>
        )}
      </div>
    </div>
  );
}
