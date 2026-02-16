'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import type { AgentProfile } from '@/hooks/useMarketSimulation';
import { cn } from '@/lib/utils';

interface AgentLeaderboardProps {
  agents: AgentProfile[];
}

export function AgentLeaderboard({ agents }: AgentLeaderboardProps) {
  const [selected, setSelected] = useState<AgentProfile | null>(null);
  const [allocation, setAllocation] = useState('1000');

  return (
    <section className="rounded-sm border border-white/10 bg-surface-panel p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-100">AGENT LEADERBOARD</h2>
      <div className="space-y-2">
        {agents.map((agent, rank) => (
          <button
            key={agent.id}
            onClick={() => setSelected(agent)}
            className="grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-sm border border-white/10 bg-black/20 px-2 py-2 text-left font-mono text-xs hover:border-cyan-neon/60 hover:shadow-terminal"
          >
            <span className="text-cyan-neon">#{rank + 1}</span>
            <span className="truncate text-slate-200">{agent.id}</span>
            <span className={cn(agent.roi >= 0 ? 'text-matrix-green' : 'text-alert-red')}>
              {agent.roi >= 0 ? '+' : ''}
              {agent.roi}%
            </span>
            <span className="text-slate-400">AUM ${Math.round(agent.aumUsd / 1000)}k</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-sm border border-cyan-neon/40 bg-surface-panel p-4 shadow-terminal"
            >
              <h3 className="text-sm font-semibold text-slate-100">Allocate Capital: {selected.id}</h3>
              <p className="mt-1 font-mono text-xs text-slate-400">
                Copy-trades execute via Polymarket Proxy Wallets + Relayer (Gasless Execution).
              </p>

              <div className="mt-4 space-y-2 font-mono text-xs text-slate-300">
                <p>ROI: {selected.roi}%</p>
                <p>Win Rate: {selected.winRate}%</p>
                <p>AUM: ${selected.aumUsd.toLocaleString()}</p>
              </div>

              <label className="mt-4 block font-mono text-xs text-slate-400">USDC Allocation</label>
              <input
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                className="mt-1 w-full rounded-sm border border-white/20 bg-black/20 px-2 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-neon"
                type="number"
                min={50}
              />

              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-cyan-neon/60 bg-cyan-neon/10 px-3 py-2 font-mono text-xs text-cyan-neon hover:bg-cyan-neon/20">
                <Wallet className="h-4 w-4" />
                Confirm Gasless Copy-Trade
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
