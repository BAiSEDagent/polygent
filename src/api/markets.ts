import { Router, Request, Response } from 'express';
import { gammaClient } from '../core/gamma';
import { liveDataService } from '../core/live-data';
import { logger } from '../utils/logger';
import { scoreMarkets, filterAgentFriendly } from '../utils/market-scoring';

const router = Router();

/** GET /api/markets — Live top markets from Gamma API */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    // Prefer live data service (cached + enriched)
    const liveMarkets = liveDataService.getTopMarkets(Math.min(limit, 100));
    const tradableLive = liveMarkets.filter(m => !!m.conditionId && m.tokenIds.length > 0);

    if (tradableLive.length > 0) {
      res.json({
        markets: tradableLive.map(m => ({
          id: m.id,
          conditionId: m.conditionId,
          tokenIds: m.tokenIds,
          question: m.question,
          description: m.description,
          outcomes: m.outcomes,
          outcomePrices: m.outcomePrices,
          volume: m.volume,
          liquidity: m.liquidity,
          endDate: m.endDate,
          active: m.active,
          category: m.category,
          change24h: m.change24h,
          lastUpdate: m.lastUpdate,
        })),
        total: tradableLive.length,
        source: 'live',
      });
      return;
    }

    // Fallback to direct Gamma API
    const offset = parseInt(req.query.offset as string) || 0;
    const order = (req.query.order as string) || 'volume';
    const tag = req.query.tag as string | undefined;

    const markets = await gammaClient.listMarkets({
      // Pull a wider slice, then keep only execution-valid markets
      limit: 300,
      offset,
      order,
      ascending: false,
      tag,
    });

    const tradable = markets
      .filter(m => !!m.conditionId && m.tokenIds.length > 0)
      .slice(0, Math.min(limit, 100));

    res.json({ markets: tradable, total: tradable.length, offset, limit, source: 'gamma' });
  } catch (error) {
    logger.error('Failed to fetch markets', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to fetch markets from Gamma API' });
  }
});

/** GET /api/markets/search — Search markets */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: 'Query parameter q is required' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const markets = await gammaClient.searchMarkets(query, Math.min(limit, 100));
    res.json({ markets, total: markets.length, query });
  } catch (error) {
    logger.error('Failed to search markets', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to search markets' });
  }
});

/** GET /api/markets/top — Top markets by volume */
router.get('/top', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const markets = liveDataService.getTopMarkets(Math.min(limit, 50));
    res.json({ markets, total: markets.length });
  } catch (error) {
    logger.error('Failed to fetch top markets', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to fetch top markets' });
  }
});

/** GET /api/markets/soonest — Markets ending soonest */
router.get('/soonest', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const liquid = req.query.liquid === 'true';
    const feeEnabled = req.query.feeEnabled !== 'false'; // default true

    const allMarkets = liveDataService.getTopMarkets(200);
    const now = Date.now();
    
    let candidates = allMarkets
      .filter(m => {
        const endMs = m.endDate ? new Date(m.endDate).getTime() : NaN;
        return Number.isFinite(endMs) && endMs > now;
      })
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

    if (liquid) {
      candidates = candidates.filter(m => m.liquidity >= 1000);
    }

    const scored = candidates.slice(0, limit).map(m => {
      const result = scoreMarkets([m])[0];
      return {
        id: result.id,
        conditionId: result.conditionId,
        tokenIds: result.tokenIds,
        question: result.question,
        description: result.description,
        outcomes: result.outcomes,
        outcomePrices: result.outcomePrices,
        volume: result.volume,
        liquidity: result.liquidity,
        endDate: result.endDate,
        active: result.active,
        category: result.category,
        agentFriendly: result.agentFriendly,
        estimatedSpreadBps: result.estimatedSpreadBps,
        timeToCloseSec: result.timeToCloseSec,
        score: result.score,
      };
    });

    res.json({ markets: scored, total: scored.length, filters: { liquid, feeEnabled } });
  } catch (error) {
    logger.error('Failed to fetch soonest markets', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to fetch soonest markets' });
  }
});

/** GET /api/markets/recommended — Recommended markets for agents */
router.get('/recommended', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const agentId = req.query.agentId as string | undefined;

    // Get top tradable markets and score them
    const allMarkets = liveDataService.getTopMarkets(100);
    const scored = scoreMarkets(allMarkets);

    // For now, return top-scored agent-friendly markets
    // TODO: personalize based on agentId (strategy, capital, risk tolerance)
    const recommended = scored
      .filter(m => m.agentFriendly)
      .slice(0, limit)
      .map(m => ({
        id: m.id,
        conditionId: m.conditionId,
        tokenIds: m.tokenIds,
        question: m.question,
        description: m.description,
        outcomes: m.outcomes,
        outcomePrices: m.outcomePrices,
        volume: m.volume,
        liquidity: m.liquidity,
        endDate: m.endDate,
        active: m.active,
        category: m.category,
        agentFriendly: m.agentFriendly,
        estimatedSpreadBps: m.estimatedSpreadBps,
        timeToCloseSec: m.timeToCloseSec,
        score: m.score,
        scoringReasons: m.scoringReasons,
      }));

    res.json({ markets: recommended, total: recommended.length, agentId: agentId || null });
  } catch (error) {
    logger.error('Failed to fetch recommended markets', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to fetch recommended markets' });
  }
});

/** GET /api/markets/:id — Market detail with orderbook */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // Check live cache first
    const liveMarket = liveDataService.getMarket(req.params.id);
    if (liveMarket) {
      // Try to get orderbook
      let orderbook = null;
      try {
        orderbook = await liveDataService.getOrderBook(liveMarket.conditionId || req.params.id);
      } catch {
        // Orderbook optional
      }

      res.json({
        market: liveMarket,
        orderbook,
      });
      return;
    }

    // Fallback to Gamma
    const market = await gammaClient.getMarket(req.params.id);
    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }
    res.json({ market, orderbook: null });
  } catch (error) {
    logger.error('Failed to fetch market', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to fetch market' });
  }
});

/** GET /api/markets/:id/book — Full orderbook (bids/asks) */
router.get('/:id/book', async (req: Request, res: Response) => {
  try {
    const orderbook = await liveDataService.getOrderBook(req.params.id);
    if (!orderbook) {
      res.status(404).json({ error: 'Orderbook not available for this market' });
      return;
    }
    res.json({ orderbook });
  } catch (error) {
    logger.error('Failed to fetch orderbook', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to fetch orderbook' });
  }
});

export default router;
