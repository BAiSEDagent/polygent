import { useCallback, useState } from 'react';
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
  const portfolioFetcher = useCallback(() => api.getPortfolio(), []);

  const { data: lb } = useApi(leaderboardFetcher, 4000);
  const { data: act } = useApi(activityFetcher, 3000);
  const { data: mkts } = useApi(marketsFetcher, 10000);
  const { data: port } = useApi(portfolioFetcher, 5000);

  const leaderboard = lb?.leaderboard ?? [];
  const activities = act?.activity ?? [];
  const markets = mkts?.markets ?? mkts?.items ?? [];

  const totalValue = leaderboard.reduce((s: number, a: any) => s + (a.equity || 0), 0);
  const totalPnl = leaderboard.reduce((s: number, a: any) => s + (a.pnl || 0), 0);
  const pnlPct = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;
  const isUp = totalPnl >= 0;

  return (
    <div className="h-full flex">
      {/* Left — Leaderboard */}
      <div className="w-[260px] min-w-[240px] border-r border-border flex flex-col shrink-0">
        <AgentLeaderboard
          agents={leaderboard}
          selectedId={selectedAgent}
          onSelect={setSelectedAgent}
        />
      </div>

      {/* Center — Live Activity */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        <div className="px-6 py-3 text-xs font-semibold text-gray-400 tracking-wider">📡 LIVE ACTIVITY</div>

        {/* Portfolio Value */}
        <div className="px-6 pb-2">
          <div className="font-mono text-5xl font-bold text-white tracking-tight">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-gray-500 text-sm mt-1">Combined Portfolio Value</div>
          <div className={`text-sm font-mono mt-0.5 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pnlPct.toFixed(2)}% today
          </div>
        </div>

        {/* Chart */}
        <div className="px-4 h-[220px] shrink-0">
          <PnLChart data={port?.history ?? []} />
        </div>

        {/* Activity Feed */}
        <div className="flex-1 overflow-hidden border-t border-border">
          <ActivityFeed activities={activities} highlightAgentId={selectedAgent} />
        </div>

        {/* Agent Distribution */}
        <div className="border-t border-border">
          <AgentDistribution agents={leaderboard} />
        </div>
      </div>

      {/* Right — Top Markets */}
      <div className="w-[280px] min-w-[260px] shrink-0">
        <MarketPanel markets={markets} />
      </div>
    </div>
  );
}
