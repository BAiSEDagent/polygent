'use client';

import { useQuery } from '@tanstack/react-query';
import { getMarkets, type Market } from '@/lib/api';
import { config } from '@/lib/config';
import { NavBar } from '@/components/NavBar';

export default function MarketsPage() {
  const { data: markets, isLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: () => getMarkets(30),
    refetchInterval: config.MARKETS_POLL_MS,
  });

  return (
    <div className="pb-16">
      <header className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <h1 className="text-lg font-bold">📈 Markets</h1>
        <p className="text-xs text-[var(--text-secondary)]">
          Top prediction markets by volume
        </p>
      </header>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-[var(--text-secondary)] text-sm">
          Loading markets...
        </div>
      ) : markets && markets.length > 0 ? (
        <div className="divide-y divide-[var(--border)]">
          {markets.map((market) => (
            <MarketRow key={market.id} market={market} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-[var(--text-secondary)] text-sm">
          No markets available
        </div>
      )}

      <NavBar />
    </div>
  );
}

function MarketRow({ market }: { market: Market }) {
  const yesPrice = market.outcomePrices[0] ?? 0.5;
  const noPrice = market.outcomePrices[1] ?? 1 - yesPrice;
  const change = market.change24h ?? 0;
  const changeColor = change >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]';

  return (
    <div className="px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors">
      {/* Question */}
      <div className="text-sm font-medium leading-snug mb-2 line-clamp-2">
        {market.question}
      </div>

      {/* Price bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent-green)] rounded-full transition-all"
            style={{ width: `${(yesPrice * 100).toFixed(0)}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs">
        <span className="font-mono text-[var(--accent-green)]">
          YES {(yesPrice * 100).toFixed(0)}¢
        </span>
        <span className="font-mono text-[var(--accent-red)]">
          NO {(noPrice * 100).toFixed(0)}¢
        </span>
        <span className="text-[var(--text-secondary)]">
          Vol ${(market.volume / 1000).toFixed(0)}K
        </span>
        {change !== 0 && (
          <span className={`font-mono ${changeColor}`}>
            {change >= 0 ? '+' : ''}{(change * 100).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
