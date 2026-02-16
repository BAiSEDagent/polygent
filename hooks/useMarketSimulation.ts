'use client';

import { useEffect, useMemo, useState } from 'react';

export type LifecycleStage = 'SIGNAL DETECTED' | 'POSITIONS OPEN' | 'EXECUTING' | 'SETTLED';
export type IntelTag = 'SIGNAL' | 'EXECUTE' | 'SETTLE' | 'ALERT';

export interface OperationCard {
  id: string;
  agentId: string;
  market: string;
  sizeUsd: number;
  liveRoi: number;
  side: 'LONG' | 'SHORT';
  stage: LifecycleStage;
  timestamp: string;
}

export interface IntelEvent {
  id: string;
  timestamp: string;
  tag: IntelTag;
  message: string;
}

export interface AgentProfile {
  id: string;
  roi: number;
  winRate: number;
  aumUsd: number;
  followers: number;
}

const agents = ['WhaleBot_9', 'QuantumArb_3', 'SentinelFX_2', 'DeltaHunter_8'];
const markets = ['Fed Rates', 'ETH > $4k by Q2', 'US Recession 2026', 'BTC ETF Net Flows'];

const getTime = () =>
  new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

const random = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const polymarketPayload = (card: OperationCard) => ({
  event_type: 'trade',
  clob_order: {
    market: card.market,
    side: card.side,
    size: card.sizeUsd,
    tif: 'GTC',
    order_type: 'limit',
  },
  gamma_market: {
    question: card.market,
    condition_id: `cond_${card.id}`,
    active: true,
  },
  relayer: {
    mode: 'proxy_wallet',
    gasless: true,
  },
});

const initialProfiles: AgentProfile[] = agents.map((id, idx) => ({
  id,
  roi: 12 - idx * 2,
  winRate: 58 + idx * 6,
  aumUsd: 220_000 + idx * 135_000,
  followers: 30 + idx * 17,
}));

export function useMarketSimulation() {
  const [operations, setOperations] = useState<OperationCard[]>([]);
  const [intelFeed, setIntelFeed] = useState<IntelEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<AgentProfile[]>(initialProfiles);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = crypto.randomUUID().slice(0, 8);
      const stageRoll = Math.random();
      const stage: LifecycleStage =
        stageRoll < 0.25 ? 'SIGNAL DETECTED' : stageRoll < 0.5 ? 'POSITIONS OPEN' : stageRoll < 0.8 ? 'EXECUTING' : 'SETTLED';
      const agentId = random(agents);
      const sizeUsd = Math.round((800 + Math.random() * 9000) / 10) * 10;
      const liveRoi = Number((Math.random() * 24 - 6).toFixed(2));
      const side = Math.random() > 0.5 ? 'LONG' : 'SHORT';
      const market = random(markets);
      const timestamp = getTime();

      const card: OperationCard = { id, agentId, market, sizeUsd, liveRoi, side, stage, timestamp };
      const payload = polymarketPayload(card);

      const tag: IntelTag = stage === 'SETTLED' ? 'SETTLE' : stage === 'EXECUTING' ? 'EXECUTE' : stage === 'SIGNAL DETECTED' ? 'SIGNAL' : 'ALERT';

      const event: IntelEvent = {
        id,
        timestamp,
        tag,
        message: `${agentId} ${stage === 'SETTLED' ? 'closed' : 'filled'} $${sizeUsd.toLocaleString()} ${side} on "${market}" | ${JSON.stringify(payload)}`,
      };

      setOperations((prev) => [card, ...prev].slice(0, 24));
      setIntelFeed((prev) => [event, ...prev].slice(0, 60));
      setLeaderboard((prev) =>
        prev
          .map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  roi: Number((agent.roi + liveRoi * 0.02).toFixed(2)),
                  winRate: Math.max(30, Math.min(93, Number((agent.winRate + (liveRoi > 0 ? 0.2 : -0.1)).toFixed(1)))),
                  aumUsd: Math.max(100_000, Math.round(agent.aumUsd + sizeUsd * 0.2)),
                }
              : agent,
          )
          .sort((a, b) => b.roi - a.roi),
      );
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  const groupedOperations = useMemo(
    () => ({
      'SIGNAL DETECTED': operations.filter((op) => op.stage === 'SIGNAL DETECTED'),
      'POSITIONS OPEN': operations.filter((op) => op.stage === 'POSITIONS OPEN'),
      EXECUTING: operations.filter((op) => op.stage === 'EXECUTING'),
      SETTLED: operations.filter((op) => op.stage === 'SETTLED'),
    }),
    [operations],
  );

  return { groupedOperations, intelFeed, leaderboard };
}
