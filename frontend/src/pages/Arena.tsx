import { useCallback, useState, useMemo } from 'react';
import AgentLeaderboard from '../components/AgentLeaderboard';
import ActivityFeed from '../components/ActivityFeed';
import MarketPanel from '../components/MarketPanel';
import PnLChart from '../components/PnLChart';
import AgentDistribution from '../components/AgentDistribution';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';

export default function Arena() {
  const [selectedAgent, setSelectedAgent] = useState<string>();

  const leaderboardFetcher = useCallback(() => api.getLeaderboard(), []);
  const activityFetcher = useCallback(() => api.getActivity(100), []);
  const marketsFetcher = useCallback(() => api.getMarkets(20), []);

  const { data: lb } = useApi(leaderboardFetcher, 4000);
  const { data: act } = useApi(activityFetcher, 3000);
  const { data: mkts } = useApi(marketsFetcher, 10000);

  const leaderboard = lb?.leaderboard ?? [];
  const activities = act?.activity ?? [];
  const markets = mkts?.markets ?? [];

  const totalValue = useMemo(
    () => leaderboard.reduce((s: number, a: any) => s + (a.equity ?? 0), 0),
    [leaderboard],
  );
  const totalPnl = useMemo(
    () => leaderboard.reduce((s: number, a: any) => s + (a.pnl ?? 0), 0),
    [leaderboard],
  );
  const pnlPct = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  return (
    <div className="h-full flex">
      {/* Left — Leaderboard */}
      <div className="w-[250px] shrink-0 border-r border-border">
        <AgentLeaderboard agents={leaderboard} selectedId={selectedAgent} onSelect={setSelectedAgent} />
      </div>

      {/* Center — Live Activity */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-white">📡 LIVE ACTIVITY</h2>
        </div>

        {/* Portfolio header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="font-mono text-5xl font-bold text-white tabular-nums">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-text-secondary text-xs mt-1">Combined Portfolio Value</div>
          <div className={`text-sm font-mono mt-1 ${totalPnl >= 0 ? 'text-success' : 'text-danger'}`}>
            {totalPnl >= 0 ? '▲' : '▼'} {totalPnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% today
          </div>
        </div>

        {/* Chart */}
        <div className="border-b border-border">
          <PnLChart totalValue={totalValue} />
        </div>

        {/* Activity Feed */}
        <div className="flex-1 overflow-y-auto">
          <ActivityFeed activities={activities} highlightAgentId={selectedAgent} />
        </div>

        {/* Distribution */}
        <AgentDistribution agents={leaderboard} />
      </div>

      {/* Right — Markets */}
      <div className="w-[280px] shrink-0">
        <MarketPanel markets={markets} />
      </div>
    </div>
  );
}
