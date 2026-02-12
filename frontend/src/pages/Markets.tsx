import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatUsd, truncate } from '../lib/format';
import SparkLine from '../components/SparkLine';

const CATEGORIES = ['All', 'Politics', 'Sports', 'Crypto', 'AI', 'Culture'];
const SORT_OPTIONS = ['Volume', 'Liquidity', 'Price'];

export default function Markets() {
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('Volume');

  const fetcher = useCallback(() => api.getMarkets(100), []);
  const { data } = useApi(fetcher, 10000);
  const markets: any[] = data?.markets ?? data?.items ?? [];

  const filtered = markets.filter((m: any) => {
    if (category === 'All') return true;
    return (m.category ?? '').toLowerCase().includes(category.toLowerCase()) ||
           (m.tags ?? []).some((t: string) => t.toLowerCase().includes(category.toLowerCase()));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'Volume') return (b.volume ?? 0) - (a.volume ?? 0);
    if (sort === 'Liquidity') return (b.liquidity ?? 0) - (a.liquidity ?? 0);
    return (b.outcomePrices?.[0] ?? 0) - (a.outcomePrices?.[0] ?? 0);
  });

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-[10px] font-mono px-2.5 py-1 border transition-colors ${
                category === c
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-text-muted mr-1">SORT</span>
          {SORT_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`text-[10px] font-mono px-2 py-1 border transition-colors ${
                sort === s
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Market Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {sorted.map((m: any, i: number) => {
          const yes = m.outcomePrices?.[0] ?? 0.5;
          const no = m.outcomePrices?.[1] ?? 0.5;
          const spark = Array.from({ length: 12 }, (_, j) =>
            yes + (Math.random() - 0.5) * 0.08 * Math.sin(j * 0.7)
          );

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-surface border border-border p-3 hover:border-primary/30 hover:glow-primary transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs text-text-primary leading-tight flex-1">
                  {truncate(m.question, 80)}
                </p>
                <SparkLine data={spark} color="auto" width={50} height={18} />
              </div>

              {/* Price bar */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-mono text-success font-medium">
                  YES {(yes * 100).toFixed(0)}¢
                </span>
                <div className="flex-1 h-1.5 bg-border overflow-hidden flex">
                  <div className="h-full bg-success" style={{ width: `${yes * 100}%` }} />
                  <div className="h-full bg-danger" style={{ width: `${no * 100}%` }} />
                </div>
                <span className="text-[11px] font-mono text-danger font-medium">
                  {(no * 100).toFixed(0)}¢ NO
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                <span>Vol {formatUsd(m.volume ?? 0)}</span>
                <span>Liq {formatUsd(m.liquidity ?? 0)}</span>
                {m.category && (
                  <span className="text-accent">{m.category}</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {markets.length === 0 && (
        <div className="text-center text-text-muted font-mono text-sm mt-20">
          Loading markets...
        </div>
      )}
    </div>
  );
}
