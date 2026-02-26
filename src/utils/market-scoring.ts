import { Market } from './types';
import { logger } from './logger';

/**
 * Market scoring for agent-friendly recommendations.
 * 
 * Agent-friendly markets have:
 * - High liquidity (>$1000)
 * - Tight spread (<5%)
 * - Clear resolution criteria
 * - Reasonable time to close (>1h, <7d)
 */

export interface ScoredMarket extends Market {
  agentFriendly: boolean;
  estimatedSpreadBps: number;
  timeToCloseSec: number;
  score: number;
  scoringReasons: string[];
}

const MIN_LIQUIDITY_USD = 1000;
const MAX_SPREAD_BPS = 500; // 5%
const MIN_TIME_TO_CLOSE_SEC = 3600; // 1 hour
const MAX_TIME_TO_CLOSE_SEC = 7 * 24 * 3600; // 7 days

/**
 * Score a market for agent-friendliness.
 * Returns 0-100 score (higher = better for agents).
 */
export function scoreMarket(market: Market): ScoredMarket {
  const now = Date.now();
  const endMs = market.endDate ? new Date(market.endDate).getTime() : NaN;
  const timeToCloseSec = Number.isFinite(endMs) ? Math.max(0, (endMs - now) / 1000) : 0;

  // Estimate spread from outcome prices
  const yesPrice = market.outcomePrices[0] ?? 0.5;
  const noPrice = market.outcomePrices[1] ?? 0.5;
  const impliedSum = yesPrice + noPrice;
  const estimatedSpreadBps = Math.max(0, (impliedSum - 1) * 10000);

  const reasons: string[] = [];
  let score = 0;

  // Liquidity scoring (0-30 points)
  if (market.liquidity >= MIN_LIQUIDITY_USD * 10) {
    score += 30;
    reasons.push('high_liquidity');
  } else if (market.liquidity >= MIN_LIQUIDITY_USD) {
    score += 20;
    reasons.push('adequate_liquidity');
  } else {
    reasons.push('low_liquidity');
  }

  // Spread scoring (0-30 points)
  if (estimatedSpreadBps <= MAX_SPREAD_BPS / 2) {
    score += 30;
    reasons.push('tight_spread');
  } else if (estimatedSpreadBps <= MAX_SPREAD_BPS) {
    score += 20;
    reasons.push('acceptable_spread');
  } else {
    reasons.push('wide_spread');
  }

  // Time window scoring (0-20 points)
  if (timeToCloseSec >= MIN_TIME_TO_CLOSE_SEC && timeToCloseSec <= MAX_TIME_TO_CLOSE_SEC) {
    score += 20;
    reasons.push('good_time_window');
  } else if (timeToCloseSec < MIN_TIME_TO_CLOSE_SEC) {
    score += 5;
    reasons.push('closing_soon');
  } else {
    reasons.push('far_future');
  }

  // Volume scoring (0-20 points)
  if (market.volume >= 50000) {
    score += 20;
    reasons.push('high_volume');
  } else if (market.volume >= 10000) {
    score += 15;
    reasons.push('moderate_volume');
  } else if (market.volume >= 1000) {
    score += 10;
    reasons.push('low_volume');
  }

  // Agent-friendly threshold: score >= 60 and meets hard gates
  const agentFriendly = score >= 60 &&
    market.liquidity >= MIN_LIQUIDITY_USD &&
    estimatedSpreadBps <= MAX_SPREAD_BPS &&
    timeToCloseSec >= MIN_TIME_TO_CLOSE_SEC;

  return {
    ...market,
    agentFriendly,
    estimatedSpreadBps,
    timeToCloseSec,
    score,
    scoringReasons: reasons,
  };
}

/**
 * Score and rank markets for agent recommendations.
 */
export function scoreMarkets(markets: Market[]): ScoredMarket[] {
  return markets
    .map(m => scoreMarket(m))
    .sort((a, b) => b.score - a.score);
}

/**
 * Filter markets by agent-friendly criteria.
 */
export function filterAgentFriendly(markets: Market[]): ScoredMarket[] {
  return scoreMarkets(markets).filter(m => m.agentFriendly);
}
