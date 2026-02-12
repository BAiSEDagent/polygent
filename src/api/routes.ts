import { Router, Request, Response } from 'express';
import agentsRouter from './agents';
import ordersRouter from './orders';
import marketsRouter from './markets';
import portfolioRouter from './portfolio';
import { liveDataService } from '../core/live-data';
import { agentRunner } from '../core/agent-runner';
import { paperTrader } from '../core/paper-trader';

const router = Router();

router.use('/agents', agentsRouter);
router.use('/orders', ordersRouter);
router.use('/markets', marketsRouter);
router.use('/portfolio', portfolioRouter);

// ─── Live Agent Endpoints ────────────────────────────────────────────────────

/** GET /api/runners — Get all registered agent runners with live stats */
router.get('/runners', (_req: Request, res: Response) => {
  const agents = agentRunner.getAgents();
  res.json({ agents, total: agents.length });
});

/** GET /api/runners/:id/trades — Paper trade history for an agent */
router.get('/runners/:id/trades', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const trades = paperTrader.getAgentTrades(req.params.id, limit);
  res.json({ trades, total: trades.length });
});

/** GET /api/leaderboard — Agent leaderboard ranked by P&L */
router.get('/leaderboard', (_req: Request, res: Response) => {
  const leaderboard = paperTrader.getLeaderboard();
  res.json({ leaderboard, total: leaderboard.length });
});

/** GET /api/activity — Recent agent activity feed */
router.get('/activity', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const activity = agentRunner.getActivity(limit);
  res.json({ activity, total: activity.length });
});

/** GET /api/stats — System-wide stats */
router.get('/stats', (_req: Request, res: Response) => {
  const liveStats = liveDataService.getStats();
  const agents = agentRunner.getAgents();
  const trades = paperTrader.getAllTrades(1000);

  res.json({
    liveData: liveStats,
    agents: {
      total: agents.length,
      active: agents.filter(a => a.status === 'active').length,
    },
    trading: {
      totalPaperTrades: trades.length,
      totalVolume: trades.reduce((s, t) => s + t.notional, 0),
    },
  });
});

export default router;
