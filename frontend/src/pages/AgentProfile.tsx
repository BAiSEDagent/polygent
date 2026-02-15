import { useParams } from 'react-router-dom';
import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { formatUsd, formatPct, timeAgo, truncate } from '../lib/format';
import AnimatedNumber from '../components/AnimatedNumber';
import PnLChart from '../components/PnLChart';

export default function AgentProfile() {
  const { id } = useParams<{ id: string }>();

  const runnersFetcher = useCallback(() => api.getRunners(), []);
  const tradesFetcher = useCallback(() => api.getRunnerTrades(id!, 100), [id]);
  const leaderboardFetcher = useCallback(() => api.getLeaderboard(), []);

  const { data: runners } = useApi(runnersFetcher, 5000);
  const { data: trades } = useApi(tradesFetcher, 5000);
  const { data: lb } = useApi(leaderboardFetcher, 5000);

  const agent = runners?.agents?.find((a: any) => a.agentId === id);
  const perf = lb?.leaderboard?.find((a: any) => a.agentId === id);
  const tradeList = trades?.trades ?? [];

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted font-mono text-sm">
        Loading agent...
      </div>
    );
  }

  // Build equity chart from trades
  const equityData = tradeList.slice().reverse().reduce((acc: any[], t: any, i: number) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].equity : agent.deposited;
    const delta = t.side === 'BUY' ? -(t.amount * t.executedPrice) : (t.amount * t.executedPrice);
    acc.push({ timestamp: t.timestamp, equity: prev + delta });
    return acc;
  }, [{ timestamp: agent.lastRun - 3600000, equity: agent.deposited }]);

  const stats = [
    { label: 'Total P&L', value: agent.pnl, format: formatUsd, pnl: true },
    { label: 'Win Rate', value: perf?.winRate ?? 0, format: formatPct },
    { label: 'Sharpe Ratio', value: perf?.sharpeRatio ?? 0, format: (n: number) => n.toFixed(2) },
    { label: 'Max Drawdown', value: perf?.maxDrawdown ?? 0, format: formatPct },
    { label: 'Total Trades', value: agent.totalTrades, format: (n: number) => n.toFixed(0) },
    { label: 'Equity', value: agent.equity, format: formatUsd },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-4"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-xl font-semibold">{agent.name}</h1>
        <span className="text-[10px] font-mono px-2 py-0.5 border border-border text-accent">
          {agent.strategy}
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 border ${
          agent.status === 'active' ? 'border-success/30 text-success' : 'border-border text-text-muted'
        }`}>
          {agent.status.toUpperCase()}
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-border px-3 py-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-text-muted">{s.label}</div>
            <AnimatedNumber
              value={s.value}
              format={s.format}
              className={`text-base ${s.pnl ? (s.value >= 0 ? 'text-success' : 'text-danger') : 'text-text-primary'}`}
            />
          </div>
        ))}
      </div>

      {/* P&L Chart */}
      <div className="mb-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">Equity Curve</div>
        <PnLChart data={equityData}  />
      </div>

      {/* Trade History */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">Trade History</div>
        <div className="border border-border bg-surface">
          {/* Header */}
          <div className="grid grid-cols-[1fr_60px_60px_60px_80px_1fr] gap-2 px-3 py-1.5 border-b border-border text-[9px] font-mono text-text-muted uppercase">
            <span>Market</span>
            <span>Side</span>
            <span>Outcome</span>
            <span>Price</span>
            <span>Size</span>
            <span>Reasoning</span>
          </div>
          {tradeList.slice(0, 50).map((t: any) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-[1fr_60px_60px_60px_80px_1fr] gap-2 px-3 py-1.5 border-b border-border/30 text-[11px] font-mono hover:bg-primary/5"
            >
              <span className="text-text-secondary truncate">{truncate(t.marketId, 30)}</span>
              <span className={t.side === 'BUY' ? 'text-primary' : 'text-amber-400'}>{t.side}</span>
              <span className="text-text-primary">{t.outcome}</span>
              <span className="text-text-primary">${t.executedPrice?.toFixed(4) ?? t.price?.toFixed(4)}</span>
              <span className="text-text-secondary">{t.amount?.toFixed(1)}</span>
              <span className="text-text-muted truncate">{truncate(t.reasoning ?? '', 60)}</span>
            </motion.div>
          ))}
          {tradeList.length === 0 && (
            <div className="p-4 text-center text-text-muted text-xs font-mono">No trades yet</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
