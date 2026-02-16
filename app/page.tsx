'use client';

import { ActivitySquare, Wifi } from 'lucide-react';
import { AgentLeaderboard } from '@/components/agents/AgentLeaderboard';
import { IntelFeed } from '@/components/dashboard/IntelFeed';
import { OperationsBoard } from '@/components/dashboard/OperationsBoard';
import { useMarketSimulation } from '@/hooks/useMarketSimulation';

export default function HomePage() {
  const { groupedOperations, intelFeed, leaderboard } = useMarketSimulation();

  return (
    <main className="min-h-screen bg-void-black px-4 py-4 lg:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-white/10 bg-surface-panel px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-wide text-slate-100">POLYGENT // AGENT TRADING TERMINAL</h1>
          <p className="font-mono text-xs text-slate-400">NASA Mission Control x Matrix · Polymarket Builder Stack</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="flex items-center gap-1 rounded-sm border border-white/10 px-2 py-1 text-cyan-neon">
            <Wifi className="h-3.5 w-3.5" /> LIVE SOCKET
          </span>
          <span className="flex items-center gap-1 rounded-sm border border-white/10 px-2 py-1 text-matrix-green">
            <ActivitySquare className="h-3.5 w-3.5" /> GASLESS EXECUTION ACTIVE
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[2.2fr_1fr]">
        <div className="space-y-3">
          <OperationsBoard columns={groupedOperations} />
          <AgentLeaderboard agents={leaderboard} />
        </div>
        <IntelFeed events={intelFeed} />
      </section>
    </main>
  );
}
