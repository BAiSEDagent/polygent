import { Router, Request, Response } from 'express';
import { gammaClient } from '../core/gamma';
import { logger } from '../utils/logger';

const router = Router();

/** GET /api/markets — List active markets */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
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

    res.json({ markets, total: markets.length, offset, limit });
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
    const markets = await gammaClient.getTopMarkets(Math.min(limit, 50));
    res.json({ markets, total: markets.length });
  } catch (error) {
    logger.error('Failed to fetch top markets', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to fetch top markets' });
  }
});

/** GET /api/markets/:id — Get market by ID */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const market = await gammaClient.getMarket(req.params.id);
    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }
    res.json(market);
  } catch (error) {
    logger.error('Failed to fetch market', { error: (error as Error).message });
    res.status(502).json({ error: 'Failed to fetch market' });
  }
});

export default router;
