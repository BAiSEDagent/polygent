interface Market {
  id: string;
  question: string;
  yesPrice?: number;
  noPrice?: number;
  volume24h?: number;
  volume?: number;
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
          const price = m.yesPrice ?? 0.5;
          const vol = m.volume24h ?? m.volume ?? 0;
          const priceCents = (price * 100).toFixed(1);

          return (
            <div key={m.id} className="px-4 py-3 border-b border-border/50 hover:bg-bg-card transition-colors">
              <div className="text-sm text-white leading-tight mb-2">{m.question}</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-emerald-400 font-mono font-bold text-sm">YES {priceCents}¢</span>
                  <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${price * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-gray-600 text-xs font-mono ml-3">Vol. {formatVol(vol)}</span>
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
