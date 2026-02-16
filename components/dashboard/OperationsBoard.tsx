'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Activity, Radar, Rocket, ShieldCheck } from 'lucide-react';
import type { LifecycleStage, OperationCard } from '@/hooks/useMarketSimulation';
import { cn } from '@/lib/utils';

const columnIcons: Record<LifecycleStage, ReactNode> = {
  'SIGNAL DETECTED': <Radar className="h-3.5 w-3.5 text-cyan-neon" />,
  'POSITIONS OPEN': <Activity className="h-3.5 w-3.5 text-matrix-green" />,
  EXECUTING: <Rocket className="h-3.5 w-3.5 text-cyan-neon" />,
  SETTLED: <ShieldCheck className="h-3.5 w-3.5 text-matrix-green" />,
};

interface OperationsBoardProps {
  columns: Record<LifecycleStage, OperationCard[]>;
}

export function OperationsBoard({ columns }: OperationsBoardProps) {
  return (
    <section className="rounded-sm border border-white/10 bg-surface-panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100">LIVE OPERATIONS BOARD</h2>
        <p className="font-mono text-xs text-cyan-neon">GAMMA + CLOB PIPELINE</p>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {(Object.keys(columns) as LifecycleStage[]).map((stage) => (
          <div key={stage} className="rounded-sm border border-white/10 bg-black/30 p-2">
            <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-1 font-mono text-[11px] tracking-wide text-slate-300">
              {columnIcons[stage]}
              <span>{stage}</span>
              <span className="ml-auto text-cyan-neon">{columns[stage].length}</span>
            </div>
            <div className="space-y-2">
              {columns[stage].slice(0, 6).map((card) => (
                <motion.div
                  layout
                  key={card.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-sm border border-white/10 bg-slate-900/40 p-2 shadow-terminal"
                >
                  <p className="font-mono text-[10px] text-slate-400">AGENT_ID: {card.agentId}</p>
                  <p className="truncate font-mono text-[11px] text-slate-200">MARKET: {card.market}</p>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px]">
                    <span>SIZE: ${card.sizeUsd.toLocaleString()}</span>
                    <span className={cn('font-semibold', card.liveRoi >= 0 ? 'text-matrix-green' : 'text-alert-red')}>
                      ROI: {card.liveRoi >= 0 ? '+' : ''}
                      {card.liveRoi}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
