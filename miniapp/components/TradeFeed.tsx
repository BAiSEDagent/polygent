'use client';

import { useState, useEffect } from 'react';
import { cogentWS, type WSTradeEvent } from '@/lib/ws';

const MAX_TRADES = 20;

export function TradeFeed() {
  const [trades, setTrades] = useState<WSTradeEvent[]>([]);

  useEffect(() => {
    cogentWS.connect();
    const unsub = cogentWS.onTrade((trade) => {
      setTrades((prev) => [trade, ...prev].slice(0, MAX_TRADES));
    });
    return () => {
      unsub();
      cogentWS.disconnect();
    };
  }, []);

  if (trades.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[var(--text-secondary)] text-sm">
        Waiting for trades...
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {trades.map((t, i) => {
        const sideColor = t.side === 'BUY' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]';
        const timeAgo = formatTimeAgo(t.timestamp);
        return (
          <div key={`${t.timestamp}-${i}`} className="px-4 py-2 flex items-center gap-2 text-xs">
            <span className={`font-mono font-medium ${sideColor}`}>
              {t.side}
            </span>
            <span className="text-[var(--text-secondary)]">{t.outcome}</span>
            <span className="font-mono">${t.amount.toFixed(2)}</span>
            <span className="text-[var(--text-secondary)]">@</span>
            <span className="font-mono">{t.price.toFixed(3)}</span>
            <span className="ml-auto text-[var(--text-secondary)]">{timeAgo}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
