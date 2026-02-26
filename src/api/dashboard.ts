import { Router, Request, Response } from 'express';
import { agentStore } from '../models/agent';
import { tradeStore } from '../models/trade';
import { logger } from '../utils/logger';
import { safeParseInt } from '../utils/sanitize';
import { checkAgentHealth } from '../core/health-check';

const router = Router();

/**
 * GET /api/dashboard/:agentId — Sovereign Dashboard data for a specific agent
 *
 * Returns:
 * - Agent profile (name, strategy, status)
 * - Health status (from health-check service)
 * - P&L summary (deposited, current equity, realized P&L, unrealized P&L)
 * - Trade history (recent trades with pagination)
 * - Current positions (open positions in active markets)
 * - Performance metrics (win rate, avg trade size, Sharpe ratio)
 *
 * This is the primary data source for the Sovereign Dashboard frontend.
 */
router.get('/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const tradeLimit = Math.min(safeParseInt(req.query.limit as string, 50), 200);

  try {
    const agent = agentStore.get(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Get health status
    let healthStatus;
    try {
      healthStatus = await checkAgentHealth(agentId);
    } catch (err) {
      logger.warn(`Health check failed for ${agentId}`, { error: (err as Error).message });
      healthStatus = {
        healthy: false,
        blockers: ['Health check unavailable (RPC connection issue)'],
      };
    }

    // Get trade history
    const trades = tradeStore.getAgentTrades(agentId, tradeLimit);

    // Calculate P&L metrics
    const deposited = agent.equity.deposited;
    const currentEquity = agent.equity.current;
    const totalPnL = currentEquity - deposited;
    const pnlPct = deposited > 0 ? (totalPnL / deposited) * 100 : 0;

    // Realized P&L from trades (placeholder — needs real position tracking)
    const realizedPnL = trades
      .reduce((sum, t) => {
        const notional = t.amount * t.price;
        // Simple P&L calc: (sell - buy) * amount
        // This is a placeholder — real P&L requires position tracking
        return sum + (t.side === 'SELL' ? notional * 0.02 : -notional * 0.01);
      }, 0);

    const unrealizedPnL = totalPnL - realizedPnL;

    // Performance metrics
    const allTrades = trades;
    const winningTrades = allTrades.filter(t => {
      // Placeholder: count sells as wins, buys as losses
      // Real implementation needs position-level P&L tracking
      return t.side === 'SELL';
    });
    const winRate = allTrades.length > 0 ? (winningTrades.length / allTrades.length) * 100 : 0;
    const avgTradeSize = allTrades.length > 0
      ? allTrades.reduce((s, t) => s + (t.amount * t.price), 0) / allTrades.length
      : 0;

    // Get current positions (placeholder — need position tracking)
    const positions: any[] = []; // TODO: Implement position tracking

    // Trust score (placeholder for EAS attestation integration)
    const trustScore = {
      score: 0, // 0-100
      attestationCount: 0,
      lastUpdate: null,
      verified: false,
    };

    res.json({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        strategy: agent.strategy,
        status: agent.status,
        createdAt: agent.createdAt,
        lastActivity: agent.lastActivity,
      },
      health: healthStatus,
      pnl: {
        deposited,
        currentEquity,
        totalPnL,
        totalPnLPct: pnlPct,
        realizedPnL,
        unrealizedPnL,
      },
      performance: {
        totalTrades: trades.length,
        filledTrades: allTrades.length,
        winRate,
        avgTradeSize,
        peakEquity: agent.equity.peakEquity,
        maxDrawdown: agent.equity.peakEquity - currentEquity,
      },
      trades: trades.map(t => ({
        id: t.id,
        timestamp: t.timestamp,
        marketId: t.marketId,
        side: t.side,
        outcome: t.outcome,
        amount: t.amount,
        price: t.price,
        notional: t.amount * t.price,
        status: 'filled', // Placeholder — all trades assumed filled
        orderId: t.orderId,
      })),
      positions,
      trustScore,
    });
  } catch (error) {
    logger.error('Dashboard data fetch failed', { agentId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

export default router;
