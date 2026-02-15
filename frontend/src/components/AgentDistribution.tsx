interface Agent {
  agentId: string;
  name: string;
  equity: number;
}

const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

interface Props {
  agents: Agent[];
}

export default function AgentDistribution({ agents }: Props) {
  const total = agents.reduce((s, a) => s + Math.max(a.equity, 0), 0) || 1;

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="text-[10px] text-text-muted font-mono mb-2">AGENT DISTRIBUTION</div>
      <div className="flex h-3 rounded-sm overflow-hidden gap-px">
        {agents.map((a, i) => (
          <div
            key={a.agentId}
            title={`${a.name}: ${((a.equity / total) * 100).toFixed(1)}%`}
            style={{
              width: `${(Math.max(a.equity, 0) / total) * 100}%`,
              backgroundColor: PALETTE[i % PALETTE.length],
            }}
            className="min-w-[4px]"
          />
        ))}
      </div>
      <div className="flex gap-3 mt-2 flex-wrap">
        {agents.map((a, i) => (
          <div key={a.agentId} className="flex items-center gap-1 text-[10px] text-text-muted">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            {a.name}
          </div>
        ))}
      </div>
    </div>
  );
}
