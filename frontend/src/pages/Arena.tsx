import { useCallback } from 'react';
import { useState } from 'react';
import AgentLeaderboard from '../components/AgentLeaderboard';
import ActivityFeed from '../components/ActivityFeed';
import MarketPanel from '../components/MarketPanel';
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
  const markets = mkts?.markets ?? mkts?.items ?? [];

  return (
    <div className="h-full flex">
      {/* Left — Leaderboard */}
      <div className="w-[30%] min-w-[280px] border-r border-border">
        <AgentLeaderboard
          agents={leaderboard}
          selectedId={selectedAgent}
          onSelect={setSelectedAgent}
        />
      </div>

      {/* Center — Activity Feed */}
      <div className="flex-1 border-r border-border">
        <ActivityFeed
          activities={activities}
          highlightAgentId={selectedAgent}
        />
      </div>

      {/* Right — Markets */}
      <div className="w-[30%] min-w-[280px]">
        <MarketPanel markets={markets} />
      </div>
    </div>
  );
}
