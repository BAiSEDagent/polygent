import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AnimatedNumber from './AnimatedNumber';
import { formatUsd, formatPct } from '../lib/format';

interface Agent {
  agentId: string;
  agentName: string;
  totalPnl: number;
  totalPnlPct: number;
  winRate: number;
  totalTrades: number;
  sharpeRatio: number;
}

interface Props {
  agents: Agent[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const STRATEGY_BADGES: Record<string, { label: string; color: string }> = {
  whale_tracker: { label: 'WHALE', color: 'text-primary' },
  arbitrage: { label: 'ARB', color: 'text-accent' },
  contrarian: { label: 'CNTR', color: 'text-danger' },
  sentiment: { label: 'SENT', color: 'text-success' },
};

function getBadge(name: string) {
  const key = name.toLowerCase().replace(/\s+/g, '_');
  for (const [k, v] of Object.entries(STRATEGY_BADGES)) {
    if (key.includes(k.split('_')[0])) return v;
  }
  return { label: 'AGT', color: 'text-text-secondary' };
}

export default function AgentLeaderboard({ agents, selectedId, onSelect }: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <h2 className="text-xs font-mono uppercase tracking-widest text-text-muted">
          Agent Leaderboard
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {agents.map((agent, i) => {
          const badge = getBadge(agent.agentName);
          const isTop3 = i < 3;
          const isSelected = agent.agentId === selectedId;
          const pnlColor = agent.totalPnl >= 0 ? 'text-success' : 'text-danger';

          return (
            <motion.div
              key={agent.agentId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                onSelect?.(agent.agentId);
                navigate(`/agent/${agent.agentId}`);
              }}
              className={`
                flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50
                hover:bg-primary/5 transition-colors
                ${isSelected ? 'bg-primary/10 glow-primary' : ''}
                ${isTop3 ? 'glow-primary' : ''}
              `}
            >
              {/* Rank */}
              <span className={`
                font-mono text-xs w-5 text-center
                ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-text-muted'}
              `}>
                {i + 1}
              </span>

              {/* Name + Badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {agent.agentName}
                  </span>
                  <span className={`text-[9px] font-mono px-1 py-0.5 bg-surface border border-border ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-text-muted">
                    WR {formatPct(agent.winRate)}
                  </span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {agent.totalTrades} trades
                  </span>
                </div>
              </div>

              {/* P&L */}
              <div className="text-right">
                <AnimatedNumber
                  value={agent.totalPnl}
                  format={formatUsd}
                  className={`text-sm ${pnlColor}`}
                />
                <div className={`text-[10px] font-mono ${pnlColor}`}>
                  {agent.totalPnlPct >= 0 ? '+' : ''}{formatPct(agent.totalPnlPct)}
                </div>
              </div>
            </motion.div>
          );
        })}
        {agents.length === 0 && (
          <div className="p-4 text-center text-text-muted text-xs font-mono">
            No agents running
          </div>
        )}
      </div>
    </div>
  );
}
