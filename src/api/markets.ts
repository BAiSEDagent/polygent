import { Router, Request, Response } from 'express';
import { gammaClient } from '../core/gamma';
import { liveDataService } from '../core/live-data';
import { logger } from '../utils/logger';

const router = Router();

/** GET /api/markets — Live top markets from Gamma API */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    // Prefer live data service (cached + enriched)
    const liveMarkets = liveDataService.getTopMarkets(Math.min(limit, 100));

    if (liveMarkets.length > 0) {
      res.json({
        markets: liveMarkets.map(m => ({
          id: m.id,
          conditionId: m.conditionId,
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
        total: liveMarkets.length,
        source: 'live',
      });
      return;
    }

    // Fallback to direct Gamma API
    const offset = parseInt(req.query.offset as string) || 0;
    const order = (req.query.order as string) || 'volume';
    const tag = req.query.tag as string | undefined;

    const markets = await gammaClient.listMarkets({
      limit: Math.min(limit, 100),
      offset,
      order,
      ascending: false,
      tag,
    });

    res.json({ markets, total: markets.length, offset, limit, source: 'gamma' });
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

export default router;
