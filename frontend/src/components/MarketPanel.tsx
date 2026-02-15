interface Market {
  id: string;
  question: string;
  outcomePrices?: number[];
  yesPrice?: number;
  volume?: number;
  volume24h?: number;
  liquidity?: number;
}

interface Props {
  markets: Market[];
}

export default function MarketPanel({ markets }: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 text-xs font-semibold text-gray-400 tracking-wider">📊 TOP MARKETS</div>
      <div className="flex-1 overflow-y-auto">
        {markets.map((m) => {
          const yesPrice = m.outcomePrices?.[0] ?? m.yesPrice ?? 0.5;
          const vol = m.volume ?? m.volume24h ?? 0;
          const priceCents = (yesPrice * 100).toFixed(1);

          return (
            <div key={m.id} className="px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className="text-[13px] text-white leading-snug mb-2">{m.question}</div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-emerald-400 font-mono font-bold text-sm shrink-0">
                    YES {priceCents}¢
                  </span>
                  <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(yesPrice * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-gray-600 text-[11px] font-mono shrink-0">Vol. {formatVol(vol)}</span>
              </div>
            </div>
          );
        })}
        {markets.length === 0 && (
          <div className="text-gray-600 text-sm text-center py-8">Loading markets...</div>
        )}
      </div>
    </div>
  );
}

function formatVol(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
