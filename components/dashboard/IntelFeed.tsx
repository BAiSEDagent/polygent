'use client';

import { useEffect, useRef } from 'react';
import type { IntelEvent } from '@/hooks/useMarketSimulation';
import { cn } from '@/lib/utils';

const tagClass: Record<IntelEvent['tag'], string> = {
  SIGNAL: 'text-yellow-300',
  EXECUTE: 'text-cyan-neon',
  SETTLE: 'text-matrix-green',
  ALERT: 'text-alert-red',
};

export function IntelFeed({ events }: { events: IntelEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = 0;
  }, [events]);

  return (
    <aside className="flex h-full min-h-[420px] flex-col rounded-sm border border-white/10 bg-surface-panel p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-100">INTEL FEED</h2>
      <div ref={containerRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {events.map((event) => (
          <div key={`${event.id}-${event.timestamp}`} className="rounded-sm border border-white/10 bg-black/20 p-2 font-mono text-[11px]">
            <p>
              <span className="text-slate-500">[{event.timestamp}] </span>
              <span className={cn(tagClass[event.tag], 'font-semibold')}>&lt;{event.tag}&gt;</span>
            </p>
            <p className="mt-1 text-slate-300">{event.message}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
