import { Agent, OrderRequest, RiskResult, Position } from '../utils/types';
import { tradeStore } from '../models/trade';
import { logger } from '../utils/logger';

/**
 * Risk Engine — evaluates every order against configurable rules.
 *
 * Rules (evaluated in order):
 * 1. Agent status check (must be active)
 * 2. Order size cap
 * 3. Position concentration limit
 * 4. Drawdown circuit breaker
 * 5. Exposure cap
 * 6. Daily loss limit
 * 7. Diversification (optional, for larger portfolios)
 */

export function evaluateRisk(agent: Agent, order: OrderRequest): RiskResult {
  const { config: rc, equity } = agent;

  // 1. Agent must be active
  if (agent.status !== 'active') {
    return {
      approved: false,
      reason: `Agent is in '${agent.status}' state. Trading is halted.`,
      rule: 'agent_status',
    };
  }

  // 2. Order size cap
  if (order.amount > rc.maxOrderSize) {
    return {
      approved: false,
      reason: `Order size $${order.amount} exceeds max $${rc.maxOrderSize}`,
      rule: 'max_order_size',
    };
  }

  // 3. Position concentration limit
  const positions = tradeStore.getAgentPositions(agent.id);
  const positionValue = getPositionValueForMarket(positions, order.marketId);
  const newPositionValue = positionValue + order.amount * order.price;
  const positionPct = newPositionValue / equity.current;

  if (positionPct > rc.maxPositionPct) {
    return {
      approved: false,
      reason: `Position in market would be ${(positionPct * 100).toFixed(1)}% of portfolio (max ${(rc.maxPositionPct * 100).toFixed(0)}%)`,
      rule: 'max_position_pct',
    };
  }

  // 4. Drawdown circuit breaker
  const drawdown = equity.peakEquity > 0
    ? (equity.peakEquity - equity.current) / equity.peakEquity
    : 0;

  if (drawdown >= rc.maxDrawdownPct) {
    logger.warn(`Circuit breaker triggered for agent ${agent.id}`, {
      drawdown: (drawdown * 100).toFixed(1) + '%',
      peakEquity: equity.peakEquity,
      currentEquity: equity.current,
    });
    return {
      approved: false,
      reason: `Drawdown ${(drawdown * 100).toFixed(1)}% exceeds circuit breaker threshold ${(rc.maxDrawdownPct * 100).toFixed(0)}%`,
      rule: 'max_drawdown',
    };
  }

  // 5. Exposure cap
  const currentExposure = tradeStore.getAgentExposure(agent.id);
  const newExposure = currentExposure + order.amount * order.price;
  const exposureRatio = newExposure / equity.current;

  if (exposureRatio > rc.maxExposure) {
    return {
      approved: false,
      reason: `Total exposure would be ${(exposureRatio * 100).toFixed(1)}% of equity (max ${(rc.maxExposure * 100).toFixed(0)}%)`,
      rule: 'max_exposure',
    };
  }

  // 6. Daily loss limit
  const dailyLoss = equity.dailyStartEquity > 0
    ? (equity.dailyStartEquity - equity.current) / equity.dailyStartEquity
    : 0;

  if (dailyLoss >= rc.dailyLossLimitPct) {
    return {
      approved: false,
      reason: `Daily loss ${(dailyLoss * 100).toFixed(1)}% exceeds limit ${(rc.dailyLossLimitPct * 100).toFixed(0)}%`,
      rule: 'daily_loss_limit',
    };
  }

  // 7. Diversification check (only for portfolios > $1,000)
  if (equity.current > 1000) {
    const marketCount = tradeStore.getAgentMarketCount(agent.id);
    // Only enforce after agent has some activity
    if (marketCount > 0 && marketCount < rc.minDiversification) {
      // Allow if this order is for a NEW market (adding diversification)
      const existingMarkets = new Set(positions.map((p) => p.marketId));
      if (existingMarkets.has(order.marketId) && positionPct > 0.30) {
        return {
          approved: false,
          reason: `Portfolio has only ${marketCount} markets (min ${rc.minDiversification}). Diversify before adding to existing positions.`,
          rule: 'min_diversification',
        };
      }
    }
  }

  logger.debug(`Risk check passed for agent ${agent.id}`, {
    positionPct: (positionPct * 100).toFixed(1) + '%',
    drawdown: (drawdown * 100).toFixed(1) + '%',
    exposureRatio: (exposureRatio * 100).toFixed(1) + '%',
  });

  return { approved: true };
}

/** Get the current notional value of positions in a specific market */
function getPositionValueForMarket(positions: Position[], marketId: string): number {
  return positions
    .filter((p) => p.marketId === marketId)
    .reduce((sum, p) => sum + Math.abs(p.size) * p.currentPrice, 0);
}

/**
 * Check if an agent should be circuit-broken (called periodically).
 * Returns true if the circuit breaker was triggered.
 */
export function checkCircuitBreaker(agent: Agent): boolean {
  if (agent.status !== 'active') return false;

  const drawdown = agent.equity.peakEquity > 0
    ? (agent.equity.peakEquity - agent.equity.current) / agent.equity.peakEquity
    : 0;

  return drawdown >= agent.config.maxDrawdownPct;
}
