import { useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';

export default function Markets() {
  const fetcher = useCallback(() => api.getMarkets(50), []);
  const { data } = useApi(fetcher, 10000);
  const markets = data?.markets ?? data?.items ?? [];

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-xl font-bold mb-4">Live Markets</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {markets.map((m: any) => (
          <div key={m.id} className="bg-bg-secondary border border-border rounded-xl p-4">
            <div className="text-sm font-medium mb-2">{m.question}</div>
            <div className="flex justify-between text-xs">
              <span className="text-accent-green font-mono">YES {((m.outcomePrices?.[0] ?? 0.5) * 100).toFixed(1)}¢</span>
              <span className="text-gray-600">Vol. {m.volume >= 1000 ? `$${(m.volume / 1000).toFixed(0)}K` : `$${m.volume}`}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
