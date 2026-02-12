import { evaluateRisk, checkCircuitBreaker } from '../src/core/risk';
import { Agent, AgentConfig, AgentEquity, OrderRequest } from '../src/utils/types';
import { tradeStore } from '../src/models/trade';

// Mock trade store methods
jest.mock('../src/models/trade', () => ({
  tradeStore: {
    getAgentPositions: jest.fn().mockReturnValue([]),
    getAgentExposure: jest.fn().mockReturnValue(0),
    getAgentMarketCount: jest.fn().mockReturnValue(0),
  },
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function makeAgent(overrides?: {
  status?: string;
  config?: Partial<AgentConfig>;
  equity?: Partial<AgentEquity>;
}): Agent {
  return {
    id: 'agent_test123',
    name: 'test-agent',
    apiKeyHash: 'hash',
    walletAddress: '0x1234',
    privateKey: '0xkey',
    proxyWallet: null,
    status: (overrides?.status as any) ?? 'active',
    config: {
      maxPositionPct: 0.20,
      maxDrawdownPct: 0.30,
      maxOrderSize: 10_000,
      dailyLossLimitPct: 0.15,
      maxExposure: 1.0,
      minDiversification: 3,
      ...overrides?.config,
    },
    equity: {
      deposited: 10_000,
      current: 10_000,
      peakEquity: 10_000,
      dailyStartEquity: 10_000,
      ...overrides?.equity,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeOrder(overrides?: Partial<OrderRequest>): OrderRequest {
  return {
    marketId: '0xmarket1',
    side: 'BUY',
    outcome: 'YES',
    amount: 100,
    price: 0.65,
    ...overrides,
  };
}

describe('Risk Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tradeStore.getAgentPositions as jest.Mock).mockReturnValue([]);
    (tradeStore.getAgentExposure as jest.Mock).mockReturnValue(0);
    (tradeStore.getAgentMarketCount as jest.Mock).mockReturnValue(0);
  });

  describe('Agent Status', () => {
    it('should reject orders for inactive agents', () => {
      const agent = makeAgent({ status: 'inactive' });
      const result = evaluateRisk(agent, makeOrder());
      expect(result.approved).toBe(false);
      if (!result.approved) {
        expect(result.rule).toBe('agent_status');
      }
    });

    it('should reject orders for circuit-broken agents', () => {
      const agent = makeAgent({ status: 'circuit_break' });
      const result = evaluateRisk(agent, makeOrder());
      expect(result.approved).toBe(false);
      if (!result.approved) {
        expect(result.rule).toBe('agent_status');
      }
    });

    it('should approve orders for active agents', () => {
      const agent = makeAgent();
      const result = evaluateRisk(agent, makeOrder());
      expect(result.approved).toBe(true);
    });
  });

  describe('Order Size Cap', () => {
    it('should reject orders exceeding max order size', () => {
      const agent = makeAgent({ config: { maxOrderSize: 500 } });
      const result = evaluateRisk(agent, makeOrder({ amount: 1000 }));
      expect(result.approved).toBe(false);
      if (!result.approved) {
        expect(result.rule).toBe('max_order_size');
      }
    });

    it('should approve orders within max order size', () => {
      const agent = makeAgent({ config: { maxOrderSize: 500 } });
      const result = evaluateRisk(agent, makeOrder({ amount: 400 }));
      expect(result.approved).toBe(true);
    });
  });

  describe('Position Concentration Limit', () => {
    it('should reject orders that would exceed max position %', () => {
      const agent = makeAgent({
        config: { maxPositionPct: 0.20 },
        equity: { current: 1000 },
      });
      // Order of $300 at 0.65 = $195 notional, on $1000 equity = 19.5% — ok
      // Order of $400 at 0.65 = $260 notional, on $1000 equity = 26% — rejected
      const result = evaluateRisk(agent, makeOrder({ amount: 400, price: 0.65 }));
      expect(result.approved).toBe(false);
      if (!result.approved) {
        expect(result.rule).toBe('max_position_pct');
      }
    });

    it('should approve orders within position limit', () => {
      const agent = makeAgent({
        config: { maxPositionPct: 0.20 },
        equity: { current: 10_000 },
      });
      const result = evaluateRisk(agent, makeOrder({ amount: 100, price: 0.65 }));
      expect(result.approved).toBe(true);
    });
  });

  describe('Drawdown Circuit Breaker', () => {
    it('should reject orders when drawdown exceeds threshold', () => {
      const agent = makeAgent({
        config: { maxDrawdownPct: 0.30 },
        equity: { current: 6500, peakEquity: 10_000, deposited: 10_000, dailyStartEquity: 10_000 },
      });
      const result = evaluateRisk(agent, makeOrder());
      expect(result.approved).toBe(false);
      if (!result.approved) {
        expect(result.rule).toBe('max_drawdown');
      }
    });

    it('should approve orders when drawdown is within threshold', () => {
      const agent = makeAgent({
        config: { maxDrawdownPct: 0.30 },
        equity: { current: 8000, peakEquity: 10_000, deposited: 10_000, dailyStartEquity: 10_000 },
      });
      const result = evaluateRisk(agent, makeOrder());
      expect(result.approved).toBe(true);
    });

    it('should trigger circuit breaker at exactly 30%', () => {
      const agent = makeAgent({
        config: { maxDrawdownPct: 0.30 },
        equity: { current: 7000, peakEquity: 10_000, deposited: 10_000, dailyStartEquity: 10_000 },
      });
      const result = evaluateRisk(agent, makeOrder());
      expect(result.approved).toBe(false);
    });
  });

  describe('Exposure Cap', () => {
    it('should reject orders that would exceed total exposure cap', () => {
      const agent = makeAgent({
        config: { maxExposure: 1.0 },
        equity: { current: 1000, peakEquity: 1000, deposited: 1000, dailyStartEquity: 1000 },
      });
      (tradeStore.getAgentExposure as jest.Mock).mockReturnValue(800);

      // $500 * 0.65 = $325 new exposure + $800 existing = $1125 > $1000
      const result = evaluateRisk(agent, makeOrder({ amount: 500, price: 0.65 }));
      expect(result.approved).toBe(false);
      if (!result.approved) {
        expect(result.rule).toBe('max_exposure');
      }
    });
  });

  describe('Daily Loss Limit', () => {
    it('should reject orders when daily loss exceeds limit', () => {
      const agent = makeAgent({
        config: { dailyLossLimitPct: 0.15 },
        equity: { current: 8000, dailyStartEquity: 10_000, peakEquity: 10_000, deposited: 10_000 },
      });
      const result = evaluateRisk(agent, makeOrder());
      expect(result.approved).toBe(false);
      if (!result.approved) {
        expect(result.rule).toBe('daily_loss_limit');
      }
    });
  });

  describe('checkCircuitBreaker', () => {
    it('should return true when drawdown exceeds threshold', () => {
      const agent = makeAgent({
        equity: { current: 6000, peakEquity: 10_000, deposited: 10_000, dailyStartEquity: 10_000 },
      });
      expect(checkCircuitBreaker(agent)).toBe(true);
    });

    it('should return false when drawdown is within threshold', () => {
      const agent = makeAgent({
        equity: { current: 9000, peakEquity: 10_000, deposited: 10_000, dailyStartEquity: 10_000 },
      });
      expect(checkCircuitBreaker(agent)).toBe(false);
    });

    it('should return false for non-active agents', () => {
      const agent = makeAgent({
        status: 'circuit_break',
        equity: { current: 5000, peakEquity: 10_000, deposited: 10_000, dailyStartEquity: 10_000 },
      });
      expect(checkCircuitBreaker(agent)).toBe(false);
    });
  });
});
