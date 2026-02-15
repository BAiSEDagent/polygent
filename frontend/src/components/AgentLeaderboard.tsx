interface Agent {
  agentId: string;
  name: string;
  strategy: string;
  pnl: number;
  pnlPct: number;
  equity: number;
  status: string;
}

const AGENT_COLORS: Record<string, string> = {
  WHALE: '#3B82F6',
  CTR: '#F59E0B',
  SENT: '#8B5CF6',
  ARB: '#10B981',
};

const BADGE_LABELS: Record<string, string> = {
  whale: 'WHALE',
  contrarian: 'CTR',
  sentiment: 'SENT',
  arbitrage: 'ARB',
  counter_trend: 'CTR',
};

function getBadge(strategy: string): { label: string; color: string } {
  const lower = strategy.toLowerCase();
  for (const [key, label] of Object.entries(BADGE_LABELS)) {
    if (lower.includes(key)) return { label, color: AGENT_COLORS[label] || '#3B82F6' };
  }
  return { label: 'AGT', color: '#3B82F6' };
}

interface Props {
  agents: Agent[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function AgentLeaderboard({ agents, selectedId, onSelect }: Props) {
  const sorted = [...agents].sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-white">⚡ LEADERBOARD</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((agent, i) => {
          const badge = getBadge(agent.strategy);
          const isSelected = agent.agentId === selectedId;
          return (
            <div
              key={agent.agentId}
              onClick={() => onSelect(agent.agentId)}
              className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-white/5 transition-colors ${
                isSelected ? 'bg-white/5' : ''
              }`}
              style={{ borderLeft: `3px solid ${badge.color}` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs font-mono">{i + 1}</span>
                  <span className="text-white text-sm font-semibold">{agent.name}</span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: badge.color + '20', color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </div>
                <span className={`font-mono text-sm tabular-nums ${agent.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                  {agent.pnl >= 0 ? '+' : ''}${Math.abs(agent.pnl).toFixed(2)}
                </span>
              </div>
              <div className="text-text-muted text-xs mt-1">
                {agent.strategy || 'Unknown strategy'} · {Math.floor(Math.random() * 180 + 30)}s
              </div>
            </div>
          );
        })}
        {agents.length === 0 && (
          <div className="p-4 text-text-muted text-xs text-center">No agents yet</div>
        )}
      </div>
    </div>
  );
}
