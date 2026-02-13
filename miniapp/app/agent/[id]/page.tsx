'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getLeaderboard, getAgentTrades, type AgentPerformance, type Trade } from '@/lib/api';
import { NavBar } from '@/components/NavBar';

const AGENT_ICONS: Record<string, string> = {
  'whale tracker': '🐋',
  'arbitrage scanner': '⚡',
  'contrarian': '🎭',
  'sentiment': '📊',
};

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = typeof params.id === 'string' ? params.id : '';

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
  });

  const { data: trades } = useQuery({
    queryKey: ['agent-trades', agentId],
    queryFn: () => getAgentTrades(agentId, 20),
    enabled: !!agentId,
  });

  const agent = leaderboard?.find((a) => a.agentId === agentId);

  if (!agent) {
    return (
      <div className="pb-16">
        <header className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
          <Link href="/" className="text-[var(--accent-blue)] text-sm">← Back</Link>
        </header>
        <div className="px-4 py-8 text-center text-[var(--text-secondary)]">
          Agent not found
        </div>
        <NavBar />
      </div>
    );
  }

  const icon = AGENT_ICONS[agent.agentName.toLowerCase()] || '🤖';
  const pnlColor = agent.totalPnl >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]';

  return (
    <div className="pb-16">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <Link href="/" className="text-[var(--accent-blue)] text-sm">← Arena</Link>
      </header>

      {/* Agent Profile Card */}
      <div className="px-4 py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{icon}</span>
          <div>
            <h1 className="text-xl font-bold">{agent.agentName}</h1>
            <p className="text-sm text-[var(--text-secondary)]">{agent.agentId}</p>
          </div>
        </div>

        {/* Key Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="P&L"
            value={`${agent.totalPnl >= 0 ? '+' : ''}$${Math.abs(agent.totalPnl).toFixed(2)}`}
            color={pnlColor}
          />
          <StatBox
            label="Return"
            value={`${agent.totalPnlPct >= 0 ? '+' : ''}${(agent.totalPnlPct * 100).toFixed(1)}%`}
            color={pnlColor}
          />
          <StatBox label="Equity" value={`$${agent.currentEquity.toLocaleString()}`} />
          <StatBox label="Win Rate" value={`${(agent.winRate * 100).toFixed(0)}%`} />
          <StatBox label="Trades" value={agent.totalTrades.toString()} />
          <StatBox label="Sharpe" value={agent.sharpeRatio.toFixed(2)} />
          <StatBox label="Max DD" value={`${(agent.maxDrawdown * 100).toFixed(1)}%`} color="text-[var(--accent-red)]" />
          <StatBox label="Deposited" value={`$${agent.depositedEquity.toLocaleString()}`} />
        </div>
      </div>

      {/* Share Button */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <ShareButton agent={agent} />
      </div>

      {/* Recent Trades */}
      <section>
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Recent Trades
          </h2>
        </div>
        {trades && trades.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {trades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-[var(--text-secondary)] text-sm">
            No trades yet
          </div>
        )}
      </section>

      <NavBar />
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--bg-card)] rounded px-3 py-2.5">
      <div className={`text-sm font-mono font-bold ${color || ''}`}>{value}</div>
      <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const sideColor = trade.side === 'BUY' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]';
  const time = new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-4 py-2.5 flex items-center gap-2">
      <span className={`text-xs font-mono font-medium w-8 ${sideColor}`}>{trade.side}</span>
      <span className="text-xs text-[var(--text-secondary)]">{trade.outcome}</span>
      <span className="text-xs font-mono">${trade.amount.toFixed(2)}</span>
      <span className="text-xs text-[var(--text-secondary)]">@</span>
      <span className="text-xs font-mono">{trade.executedPrice.toFixed(3)}</span>
      <span className="ml-auto text-xs text-[var(--text-secondary)]">{time}</span>
    </div>
  );
}

function ShareButton({ agent }: { agent: AgentPerformance }) {
  const handleShare = async () => {
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk');
      const pnlStr = `${agent.totalPnl >= 0 ? '+' : ''}$${Math.abs(agent.totalPnl).toFixed(2)} (${(agent.totalPnlPct * 100).toFixed(1)}%)`;
      const text = `${agent.agentName} on Cogent: ${pnlStr} P&L across ${agent.totalTrades} trades with ${(agent.winRate * 100).toFixed(0)}% win rate ⚡`;

      sdk.actions.composeCast({ text });
    } catch {
      // Not in Farcaster context — copy to clipboard
      const text = `${agent.agentName}: ${agent.totalPnl >= 0 ? '+' : ''}$${Math.abs(agent.totalPnl).toFixed(2)} P&L`;
      navigator.clipboard?.writeText(text);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="w-full py-2.5 bg-[var(--accent-blue)] hover:bg-[#0066FF] text-white text-sm font-medium rounded transition-colors"
    >
      Share Performance
    </button>
  );
}
