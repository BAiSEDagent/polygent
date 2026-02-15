const AGENT_META: Record<string, { border: string; badge: string; badgeText: string; label: string }> = {
  agent_arbitrage_scanner: { border: 'border-l-blue-500', badge: 'bg-blue-500/20 text-blue-400', badgeText: 'ARB', label: 'Cross-market mispricing · 120s' },
  agent_whale_tracker: { border: 'border-l-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400', badgeText: 'WHALE', label: 'Smart money following · 300s' },
  agent_contrarian: { border: 'border-l-orange-500', badge: 'bg-orange-500/20 text-orange-400', badgeText: 'CTR', label: 'Mean reversion · 600s' },
  agent_sentiment: { border: 'border-l-purple-500', badge: 'bg-purple-500/20 text-purple-400', badgeText: 'SENT', label: 'News + social signals · 900s' },
};

interface Agent {
  agentId: string;
  agentName?: string;
  name?: string;
  totalPnl?: number;
  pnl?: number;
  currentEquity?: number;
  equity?: number;
}

interface Props {
  agents: Agent[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export default function AgentLeaderboard({ agents, selectedId, onSelect }: Props) {
  const sorted = [...agents].sort((a, b) => getPnl(b) - getPnl(a));

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 text-xs font-semibold text-gray-400 tracking-wider">⚡ LEADERBOARD</div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((agent, i) => {
          const id = agent.agentId;
          const meta = AGENT_META[id] || { border: 'border-l-gray-500', badge: 'bg-gray-500/20 text-gray-400', badgeText: '?', label: '' };
          const pnl = getPnl(agent);
          const isProfit = pnl >= 0;
          const name = agent.agentName || agent.name || id;

          return (
            <div
              key={id}
              onClick={() => onSelect?.(id)}
              className={`px-4 py-3 border-l-2 ${meta.border} cursor-pointer transition-colors ${
                selectedId === id ? 'bg-white/5' : 'hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-gray-600 font-mono text-xs w-3 shrink-0">{i + 1}</span>
                  <span className="font-semibold text-sm text-white truncate">{name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${meta.badge}`}>
                    {meta.badgeText}
                  </span>
                </div>
                <span className={`font-mono text-sm font-bold shrink-0 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isProfit ? '+' : '-'}${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-[11px] text-gray-600 mt-0.5 ml-5">{meta.label}</div>
            </div>
          );
        })}
        {agents.length === 0 && (
          <div className="text-gray-600 text-sm text-center py-8">No agents registered</div>
        )}
      </div>
    </div>
  );
}

function getPnl(a: Agent): number {
  return a.totalPnl ?? a.pnl ?? 0;
}

function getEquity(a: Agent): number {
  return a.currentEquity ?? a.equity ?? 0;
}
