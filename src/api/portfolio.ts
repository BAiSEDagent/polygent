import { Router, Request, Response } from 'express';
import { authenticateAgent, requireAdmin } from '../utils/auth';
import { agentStore } from '../models/agent';
import { tradeStore } from '../models/trade';
import { gammaClient } from '../core/gamma';
import { Agent, Portfolio, Position } from '../utils/types';

const router = Router();

/** GET /api/portfolio — Portfolio for authenticated agent (via X-API-Key) */
router.get('/', authenticateAgent, async (req: Request, res: Response) => {
  const agent = (req as any).agent as Agent;
  try {
    // Update lastActivity
    agentStore.update(agent.id, { lastActivity: Date.now() } as any);
    const portfolio = await buildPortfolio(agent);
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate portfolio' });
  }
});

/** GET /api/portfolio/history — Trade history for authenticated agent */
router.get('/history', authenticateAgent, (req: Request, res: Response) => {
  const agent = (req as any).agent as Agent;
  const limit = parseInt(req.query.limit as string) || 50;
  const trades = tradeStore.getAgentTrades(agent.id, limit);
  res.json({ trades, total: trades.length });
});

/** GET /api/portfolio/leaderboard — Agent leaderboard */
router.get('/leaderboard', async (_req: Request, res: Response) => {
  const agents = agentStore.list().filter((a) => a.status !== 'inactive');

  const leaderboard = agents
    .map((agent) => {
      const positions = tradeStore.getAgentPositions(agent.id);
      const totalExposure = positions.reduce(
        (sum, p) => sum + Math.abs(p.size) * p.currentPrice,
        0
      );
      const pnl = agent.equity.current - agent.equity.deposited;
      const pnlPct = agent.equity.deposited > 0 ? pnl / agent.equity.deposited : 0;

      return {
        agentId: agent.id,
        name: agent.name,
        strategy: agent.strategy ?? 'unknown',
        equity: agent.equity.current,
        deposited: agent.equity.deposited,
        pnl,
        pnlPct,
        positionCount: positions.length,
        marketCount: new Set(positions.map((p) => p.marketId)).size,
        totalExposure,
        status: agent.status,
      };
    })
    .sort((a, b) => b.pnlPct - a.pnlPct);

  res.json({ leaderboard, total: leaderboard.length });
});

/** GET /api/portfolio/:agentId — Get agent portfolio with P&L (admin) */
router.get('/:agentId', requireAdmin, async (req: Request, res: Response) => {
  const agent = agentStore.get(req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  try {
    const portfolio = await buildPortfolio(agent);
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate portfolio' });
  }
});

/** GET /api/portfolio/:agentId/history — Trade history (admin) */
router.get('/:agentId/history', requireAdmin, (req: Request, res: Response) => {
  const agent = agentStore.get(req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const trades = tradeStore.getAgentTrades(agent.id, limit);
  res.json({ trades, total: trades.length });
});

async function buildPortfolio(agent: Agent): Promise<Portfolio> {
  const positions = tradeStore.getAgentPositions(agent.id);

  const updatedPositions: Position[] = await Promise.all(
    positions.map(async (pos) => {
      try {
        const market = await gammaClient.getMarket(pos.marketId);
        if (market && market.outcomePrices.length > 0) {
          const priceIndex = pos.outcome === 'YES' ? 0 : 1;
          const currentPrice = market.outcomePrices[priceIndex] ?? pos.currentPrice;
          const unrealizedPnl = pos.size * (currentPrice - pos.avgPrice);
          return {
            ...pos,
            currentPrice,
            unrealizedPnl,
            marketQuestion: market.question,
          };
        }
      } catch {
        // Use existing price if API fails
      }
      return pos;
    })
  );

  const totalPnl = agent.equity.current - agent.equity.deposited;
  const totalPnlPct = agent.equity.deposited > 0 ? totalPnl / agent.equity.deposited : 0;
  const openExposure = updatedPositions.reduce(
    (sum, p) => sum + Math.abs(p.size) * p.currentPrice,
    0
  );

  return {
    agentId: agent.id,
    positions: updatedPositions,
    totalEquity: agent.equity.current,
    totalPnl,
    totalPnlPct,
    openExposure,
  };
}

export default router;
