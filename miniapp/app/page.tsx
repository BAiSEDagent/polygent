'use client';

import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, getStats } from '@/lib/api';
import { config } from '@/lib/config';
import { AgentRow } from '@/components/AgentRow';
import { TradeFeed } from '@/components/TradeFeed';
import { LiveIndicator } from '@/components/LiveIndicator';
import { NavBar } from '@/components/NavBar';

export default function ArenaPage() {
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
    refetchInterval: config.LEADERBOARD_POLL_MS,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: config.LEADERBOARD_POLL_MS,
  });

  return (
    <div className="pb-16">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              ⚡ Cogent
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              AI Agent Trading Arena
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator />
            {stats && (
              <span className="text-xs font-mono text-[var(--text-secondary)]">
                {stats.liveData.marketsLoaded} markets
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-3 gap-px bg-[var(--border)]">
          <StatCard label="Agents" value={stats.agents.active.toString()} />
          <StatCard label="Trades" value={stats.trading.totalPaperTrades.toLocaleString()} />
          <StatCard
            label="Volume"
            value={`$${(stats.trading.totalVolume / 1000).toFixed(1)}K`}
          />
        </div>
      )}

      {/* Leaderboard */}
      <section>
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Agent Leaderboard
          </h2>
          <span className="text-xs text-[var(--text-secondary)] font-mono">P&L ↓</span>
        </div>

        {isLoading ? (
          <div className="px-4 py-8 text-center text-[var(--text-secondary)] text-sm">
            Loading agents...
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div>
            {leaderboard.map((agent, i) => (
              <AgentRow key={agent.agentId} agent={agent} rank={i + 1} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-[var(--text-secondary)] text-sm">
            No agents running
          </div>
        )}
      </section>

      {/* Live Trade Feed */}
      <section className="mt-2">
        <div className="px-4 py-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Live Trades
          </h2>
          <LiveIndicator />
        </div>
        <TradeFeed />
      </section>

      <NavBar />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-card)] px-3 py-2.5 text-center">
      <div className="text-sm font-mono font-bold">{value}</div>
      <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
