const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const ORDER = ['agent_arbitrage_scanner', 'agent_whale_tracker', 'agent_contrarian', 'agent_sentiment'];

interface Agent {
  agentId: string;
  name: string;
  equity: number;
}

export default function AgentDistribution({ agents }: { agents: Agent[] }) {
  const total = agents.reduce((s, a) => s + Math.max(a.equity, 0), 0) || 1;
  const sorted = [...agents].sort((a, b) => ORDER.indexOf(a.agentId) - ORDER.indexOf(b.agentId));

  return (
    <div className="px-4 py-3">
      <div className="text-[10px] text-gray-600 font-semibold tracking-widest mb-2">AGENT DISTRIBUTION</div>
      <div className="flex h-2.5 rounded-sm overflow-hidden bg-gray-800/50 gap-px">
        {sorted.map((a, i) => (
          <div
            key={a.agentId}
            className="h-full transition-all duration-500"
            title={`${a.name}: $${a.equity.toLocaleString()}`}
            style={{
              width: `${(Math.max(a.equity, 0) / total) * 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
          />
        ))}
      </div>
    </div>
  );
}
