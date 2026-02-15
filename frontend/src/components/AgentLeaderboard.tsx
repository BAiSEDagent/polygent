const AGENT_COLORS: Record<string, { border: string; badge: string; badgeText: string; label: string }> = {
  agent_arbitrage_scanner: { border: 'border-l-blue-500', badge: 'bg-blue-500/20 text-blue-400', badgeText: 'ARB', label: 'Cross-market mispricing · 120s' },
  agent_whale_tracker: { border: 'border-l-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400', badgeText: 'WHALE', label: 'Smart money following · 300s' },
  agent_contrarian: { border: 'border-l-orange-500', badge: 'bg-orange-500/20 text-orange-400', badgeText: 'CTR', label: 'Mean reversion · 600s' },
  agent_sentiment: { border: 'border-l-purple-500', badge: 'bg-purple-500/20 text-purple-400', badgeText: 'SENT', label: 'News + social signals · 900s' },
};

interface Agent {
  agentId: string;
  name: string;
  pnl: number;
  equity: number;
  strategy: string;
}

interface Props {
  agents: Agent[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export default function AgentLeaderboard({ agents, selectedId, onSelect }: Props) {
  const sorted = [...agents].sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 text-xs font-semibold text-gray-400 tracking-wider">⚡ LEADERBOARD</div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((agent, i) => {
          const c = AGENT_COLORS[agent.agentId] || AGENT_COLORS.agent_arbitrage_scanner;
          const isProfit = agent.pnl >= 0;
          return (
            <div
              key={agent.agentId}
              onClick={() => onSelect?.(agent.agentId)}
              className={`px-4 py-3 border-l-2 ${c.border} cursor-pointer transition-colors ${
                selectedId === agent.agentId ? 'bg-bg-hover' : 'hover:bg-bg-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-mono text-xs w-4">{i + 1}</span>
                  <span className="font-semibold text-sm text-white truncate">{agent.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.badge}`}>{c.badgeText}</span>
                </div>
                <span className={`font-mono text-sm font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfit ? '+' : ''}{formatUsd(agent.pnl)}
                </span>
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5 ml-6">{c.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatUsd(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
