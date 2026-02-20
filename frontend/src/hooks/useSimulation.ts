import { useEffect, useState, useRef } from 'react';

const agents = [
  'WhaleBot_9', 'QuantumArb_3', 'SentinelFX_2', 'DeltaHunter_8',
  'Poly_Arb_V1', 'MomentumX', 'SpreadHawk', 'NegRisk_Alpha',
];

const markets = [
  'Fed Rates Cut by June', 'ETH > $4k by Q2', 'US Recession 2026',
  'BTC ETF Net Flows > $1B', 'Trump Deport 750k+', 'XRP > $1.10',
  'Will AI pass bar exam 2026', 'Nvidia > $200 by March',
  'Ukraine ceasefire by April', 'Apple launches AR glasses',
  'Bitcoin dominance > 60%', 'Solana flips Ethereum TVL',
  'S&P 500 > 6000', 'Gold > $3000', 'OpenAI IPO 2026',
];

const types = ['signal', 'trade', 'paper_trade', 'execute', 'fill', 'settle', 'close'];
const sides = ['BUY', 'SELL'];
const outcomes = ['YES', 'NO'];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function genEvent(id: number) {
  const type = pick(types);
  const amount = Math.round((500 + Math.random() * 9500) / 10) * 10;
  const price = Math.round(Math.random() * 90 + 5) / 100;
  const pnl = Math.random() * 28 - 5;
  return {
    id: `sim_${id}_${Date.now()}`,
    agentId: pick(agents),
    agentName: pick(agents),
    type,
    market: pick(markets),
    side: pick(sides),
    outcome: pick(outcomes),
    amount,
    price,
    pnl: type === 'settle' || type === 'close' ? pnl : undefined,
    timestamp: Date.now() - Math.floor(Math.random() * 300000),
    reasoning: type === 'paper_trade' ? `Cross-market spread detected: ${(Math.random() * 8 + 2).toFixed(1)}%` : undefined,
  };
}

export function useSimulation(realActivities: any[], enabled = true) {
  const [simEvents, setSimEvents] = useState<any[]>(() => {
    // Seed with initial batch
    const initial = [];
    for (let i = 0; i < 30; i++) initial.push(genEvent(i));
    initial.sort((a, b) => b.timestamp - a.timestamp);
    return initial;
  });
  const counter = useRef(100);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const newEvent = genEvent(counter.current++);
      newEvent.timestamp = Date.now();
      setSimEvents(prev => [newEvent, ...prev].slice(0, 80));
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [enabled]);

  // Merge real + sim, real first, sorted by timestamp
  const merged = [...realActivities, ...simEvents]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 100);

  return merged;
}
