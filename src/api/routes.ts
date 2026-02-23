import { Router, Request, Response } from 'express';
import agentsRouter from './agents';
import ordersRouter from './orders';
import builderSignRouter from './builder-sign';
import marketsRouter from './markets';
import portfolioRouter from './portfolio';
import copiersRouter from './copiers';
import { liveDataService } from '../core/live-data';
import { agentRunner } from '../core/agent-runner';
import { paperTrader } from '../core/paper-trader';
import { agentStore } from '../models/agent';
import { tradeStore } from '../models/trade';
import { fullSetArbObserver } from '../services/fullset-observer';
import { authenticateAgent, requireAdmin } from '../utils/auth';

const router = Router();

router.use('/agents', agentsRouter);
router.use('/orders', ordersRouter);

// Mount at /api/sign — but also need /sign at root for SDK compatibility
router.use('/sign', builderSignRouter);
router.use('/markets', marketsRouter);
router.use('/portfolio', portfolioRouter);
router.use('/copiers', copiersRouter);

// ─── Live Agent Endpoints ────────────────────────────────────────────────────

/** GET /api/runners — Get all registered agent runners with live stats (requires auth) */
router.get('/runners', authenticateAgent, (_req: Request, res: Response) => {
  const agents = agentRunner.getAgents();
  res.json({ agents, total: agents.length });
});

/** GET /api/runners/:id/trades — Paper trade history for an agent (requires auth) */
router.get('/runners/:id/trades', authenticateAgent, (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const trades = paperTrader.getAgentTrades(req.params.id, limit);
  res.json({ trades, total: trades.length });
});

/** GET /api/leaderboard — Agent leaderboard ranked by P&L */
router.get('/leaderboard', (_req: Request, res: Response) => {
  const leaderboard = paperTrader.getLeaderboard();
  res.json({ leaderboard, total: leaderboard.length });
});

/** GET /api/activity — Recent agent activity feed (requires auth) */
router.get('/activity', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
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

/** GET /api/connected-agents — External agents that registered via API (requires auth) */
router.get('/connected-agents', requireAdmin, (_req: Request, res: Response) => {
  const agents = agentStore.list()
    .filter(a => a.registeredViaApi)
    .map(a => {
      const trades = tradeStore.getAgentTrades(a.id, 1);
      const pnl = a.equity.current - a.equity.deposited;
      const idleMs = Date.now() - (a.lastActivity ?? a.createdAt);
      const isActive = idleMs < 5 * 60_000; // active if activity in last 5 min
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        strategy: a.strategy,
        status: isActive ? 'active' : 'idle',
        lastActivity: a.lastActivity ?? a.createdAt,
        pnl,
        equity: a.equity.current,
        totalTrades: tradeStore.getAgentTrades(a.id, 10000).length,
        createdAt: a.createdAt,
      };
    });
  res.json({ agents, total: agents.length });
});

// ─── Full-Set Arb Observer endpoints ────────────────────────────────────────

/** GET /api/fullset/report — Aggregate opportunity stats since observer start */
router.get('/fullset/report', (_req: Request, res: Response) => {
  res.json(fullSetArbObserver.getReport());
});

/** GET /api/fullset/snapshots?universe=BTC_5M&limit=100 */
router.get('/fullset/snapshots', (req: Request, res: Response) => {
  const universe = req.query.universe as string | undefined;
  const limit = parseInt(req.query.limit as string ?? '100', 10);
  res.json({ snapshots: fullSetArbObserver.getRecentSnapshots(universe, limit) });
});

/** GET /api/fullset/opportunities?universe=BTC_5M&limit=50 */
router.get('/fullset/opportunities', (req: Request, res: Response) => {
  const universe = req.query.universe as string | undefined;
  const limit = parseInt(req.query.limit as string ?? '50', 10);
  res.json({ opportunities: fullSetArbObserver.getCompletedOpps(universe, limit) });
});

export default router;
