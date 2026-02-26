import { scoreMarket, scoreMarkets, filterAgentFriendly } from '../src/utils/market-scoring';
import { Market } from '../src/utils/types';

describe('Market Scoring', () => {
  const baseMarket: Market = {
    id: '1',
    conditionId: 'cond1',
    questionId: 'q1',
    question: 'Test Market',
    description: 'Test description',
    outcomes: ['YES', 'NO'],
    outcomePrices: [0.5, 0.5],
    tokenIds: ['token1', 'token2'],
    negRisk: false,
    volume: 5000,
    liquidity: 2000,
    endDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24h from now
    active: true,
    closed: false,
    category: 'test',
    tags: [],
  };

  describe('scoreMarket', () => {
    it('should score a high-quality market as agent-friendly', () => {
      const market: Market = {
        ...baseMarket,
        volume: 100000,
        liquidity: 50000,
        outcomePrices: [0.51, 0.50], // 1% spread
      };

      const scored = scoreMarket(market);

      expect(scored.agentFriendly).toBe(true);
      expect(scored.score).toBeGreaterThan(60);
      expect(scored.estimatedSpreadBps).toBeLessThan(200);
      expect(scored.timeToCloseSec).toBeGreaterThan(3600);
    });

    it('should mark low-liquidity markets as not agent-friendly', () => {
      const market: Market = {
        ...baseMarket,
        liquidity: 500, // Below MIN_LIQUIDITY_USD
      };

      const scored = scoreMarket(market);

      expect(scored.agentFriendly).toBe(false);
      expect(scored.scoringReasons).toContain('low_liquidity');
    });

    it('should mark wide-spread markets as not agent-friendly', () => {
      const market: Market = {
        ...baseMarket,
        outcomePrices: [0.6, 0.5], // 10% spread
      };

      const scored = scoreMarket(market);

      expect(scored.agentFriendly).toBe(false);
      expect(scored.estimatedSpreadBps).toBeGreaterThan(500);
    });

    it('should mark soon-closing markets with reduced score', () => {
      const market: Market = {
        ...baseMarket,
        endDate: new Date(Date.now() + 1800 * 1000).toISOString(), // 30min from now
      };

      const scored = scoreMarket(market);

      expect(scored.agentFriendly).toBe(false);
      expect(scored.timeToCloseSec).toBeLessThan(3600);
      expect(scored.scoringReasons).toContain('closing_soon');
    });

    it('should calculate spread correctly from outcome prices', () => {
      const market: Market = {
        ...baseMarket,
        outcomePrices: [0.52, 0.49], // sum = 1.01, spread = 1%
      };

      const scored = scoreMarket(market);

      expect(scored.estimatedSpreadBps).toBeCloseTo(100, 0);
    });
  });

  describe('scoreMarkets', () => {
    it('should rank markets by score descending', () => {
      const markets: Market[] = [
        { ...baseMarket, id: '1', liquidity: 1000, volume: 1000 },
        { ...baseMarket, id: '2', liquidity: 50000, volume: 100000 },
        { ...baseMarket, id: '3', liquidity: 5000, volume: 10000 },
      ];

      const scored = scoreMarkets(markets);

      expect(scored[0].id).toBe('2'); // highest liquidity + volume
      expect(scored[0].score).toBeGreaterThan(scored[1].score);
      expect(scored[1].score).toBeGreaterThan(scored[2].score);
    });
  });

  describe('filterAgentFriendly', () => {
    it('should return only agent-friendly markets', () => {
      const markets: Market[] = [
        { ...baseMarket, id: '1', liquidity: 500 }, // not agent-friendly
        { ...baseMarket, id: '2', liquidity: 50000, volume: 100000 }, // agent-friendly
        { ...baseMarket, id: '3', outcomePrices: [0.6, 0.5] }, // wide spread, not agent-friendly
      ];

      const filtered = filterAgentFriendly(markets);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
      expect(filtered[0].agentFriendly).toBe(true);
    });
  });
});
