interface LeaderboardProps {
  agents: any[];
  onSelectAgent: (agent: any) => void;
}

export function Leaderboard({ agents, onSelectAgent }: LeaderboardProps) {
  if (!agents.length) return null;

  return (
    <section className="border border-border bg-surface/50 backdrop-blur-sm rounded-sm p-4">
      <h2 className="text-[13px] font-bold tracking-wide text-header mb-3">AGENT LEADERBOARD</h2>
      <div className="space-y-1.5">
        {agents.map((agent, rank) => (
          <button
            key={agent.agentId}
            onClick={() => onSelectAgent(agent)}
            className="grid w-full grid-cols-[24px_1fr_80px_70px] items-center gap-3 border border-border bg-void/80 rounded-sm px-3 py-2.5 text-left text-[11px] hover:border-primary/30 hover:shadow-[0_0_10px_rgba(59,130,246,0.08)] transition-all"
          >
            <span className="text-success font-bold">#{rank + 1}</span>
            <span className="text-slate-200 truncate">{agent.agentName}</span>
            <span className={`text-right font-bold ${agent.totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
              {agent.totalPnl >= 0 ? '+' : ''}{agent.totalPnlPct?.toFixed(1) ?? '0.0'}%
            </span>
            <span className="text-muted text-right">
              AUM ${Math.round((agent.currentEquity ?? 0) / 1000)}k
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
