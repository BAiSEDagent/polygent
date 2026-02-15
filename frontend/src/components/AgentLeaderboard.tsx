const AGENT_COLORS: Record<string, string> = {
  'Whale Tracker': '#3B82F6',
  'Arbitrage Scanner': '#10B981',
  'Contrarian': '#F59E0B',
  'Sentiment': '#8B5CF6',
};

const BADGES: Record<string, { label: string; color: string }> = {
  'Whale Tracker': { label: 'WHALE', color: 'bg-blue-500/20 text-blue-400' },
  'Arbitrage Scanner': { label: 'ARB', color: 'bg-emerald-500/20 text-emerald-400' },
  'Contrarian': { label: 'CTR', color: 'bg-amber-500/20 text-amber-400' },
  'Sentiment': { label: 'SENT', color: 'bg-purple-500/20 text-purple-400' },
};

interface Agent {
  agentId: string;
  name: string;
  strategy: string;
  pnl: number;
  equity: number;
  totalTrades: number;
  lastRun: number;
}

export default function AgentLeaderboard({
  agents,
  selectedId,
  onSelect,
}: {
  agents: Agent[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const sorted = [...agents].sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-gray-400 tracking-wider">⚡ LEADERBOARD</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((agent, i) => {
          const color = AGENT_COLORS[agent.name] ?? '#6B7280';
          const badge = BADGES[agent.name];
          const isSelected = agent.agentId === selectedId;
          return (
            <div
              key={agent.agentId}
              onClick={() => onSelect?.(agent.agentId)}
              className={`px-4 py-3 border-b border-border cursor-pointer transition-colors hover:bg-bg-hover ${
                isSelected ? 'bg-bg-hover' : ''
              }`}
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-mono text-sm">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{agent.name}</span>
                      {badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">
                      {agent.strategy} · {agent.totalTrades} trades
                    </span>
                  </div>
                </div>
                <span
                  className={`font-mono font-bold text-sm ${agent.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
                >
                  {agent.pnl >= 0 ? '+' : ''}${agent.pnl.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
