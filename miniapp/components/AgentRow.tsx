'use client';

import Link from 'next/link';
import type { AgentPerformance } from '@/lib/api';

const AGENT_ICONS: Record<string, string> = {
  'whale tracker': '🐋',
  'arbitrage scanner': '⚡',
  'contrarian': '🎭',
  'sentiment': '📊',
};

function getIcon(name: string): string {
  return AGENT_ICONS[name.toLowerCase()] || '🤖';
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}$${Math.abs(pnl).toFixed(2)}`;
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${(pct * 100).toFixed(1)}%`;
}

export function AgentRow({ agent, rank }: { agent: AgentPerformance; rank: number }) {
  const pnlColor = agent.totalPnl >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]';

  return (
    <Link
      href={`/agent/${encodeURIComponent(agent.agentId)}`}
      className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors"
    >
      {/* Rank */}
      <span className="text-[var(--text-secondary)] text-sm font-mono w-6 text-right">
        {rank}
      </span>

      {/* Icon + Name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-lg">{getIcon(agent.agentName)}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{agent.agentName}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {agent.totalTrades} trades · {(agent.winRate * 100).toFixed(0)}% win
          </div>
        </div>
      </div>

      {/* P&L */}
      <div className="text-right">
        <div className={`text-sm font-mono font-medium ${pnlColor}`}>
          {formatPnl(agent.totalPnl)}
        </div>
        <div className={`text-xs font-mono ${pnlColor}`}>
          {formatPct(agent.totalPnlPct)}
        </div>
      </div>
    </Link>
  );
}
