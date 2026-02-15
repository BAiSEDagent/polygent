const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

interface Agent {
  agentId: string;
  name: string;
  equity: number;
}

export default function AgentDistribution({ agents }: { agents: Agent[] }) {
  const total = agents.reduce((s, a) => s + Math.max(a.equity, 0), 0) || 1;

  return (
    <div className="px-4 py-2">
      <div className="text-[10px] text-gray-600 font-semibold tracking-wider mb-1.5">AGENT DISTRIBUTION</div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
        {agents.map((a, i) => (
          <div
            key={a.agentId}
            className="h-full transition-all"
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
