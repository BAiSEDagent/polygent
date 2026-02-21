import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { ethers } from 'ethers';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../utils/auth';
import { copierStore } from '../models/copier';
import { copyEngine } from '../core/copy-engine';

const router = Router();

const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/copiers
 * Public endpoint called by wallet-connected frontend after deriveApiKey()
 */
router.post('/', publicLimiter, (req: Request, res: Response) => {
  const { copierAddress, agentId, fixedUsdc, apiKey, apiSecret, apiPassphrase, l2PrivateKey } = req.body ?? {};

  if (!copierAddress || !agentId || !apiKey || !apiSecret || !apiPassphrase || !l2PrivateKey) {
    res.status(400).json({ error: 'copierAddress, agentId, apiKey, apiSecret, apiPassphrase, l2PrivateKey are required' });
    return;
  }
  if (!ethers.utils.isAddress(String(copierAddress))) {
    res.status(400).json({ error: 'copierAddress must be a valid Ethereum address' });
    return;
  }
  const usd = Number(fixedUsdc);
  if (!Number.isFinite(usd) || usd <= 0 || usd > 1000) {
    res.status(400).json({ error: 'fixedUsdc must be between 0 and 1000' });
    return;
  }

  try {
    const delegation = copierStore.create({
      id: `cp_${uuid().replace(/-/g, '').slice(0, 12)}`,
      copierAddress: ethers.utils.getAddress(String(copierAddress)),
      agentId: String(agentId),
      fixedUsdc: usd,
      apiKey: String(apiKey),
      apiSecret: String(apiSecret),
      apiPassphrase: String(apiPassphrase),
      l2PrivateKey: String(l2PrivateKey),
      active: true,
    });

    res.status(201).json({
      id: delegation.id,
      copierAddress: delegation.copierAddress,
      agentId: delegation.agentId,
      fixedUsdc: delegation.fixedUsdc,
      active: delegation.active,
      createdAt: delegation.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || 'Failed to create copier delegation' });
  }
});

router.get('/delegations/:agentId', requireAdmin, (req: Request, res: Response) => {
  const delegations = copierStore.publicViewByAgent(req.params.agentId);
  res.json({ delegations, total: delegations.length });
});

/**** Admin test hook: simulate source trade to validate copy execution ****/
router.post('/test-trigger', requireAdmin, (req: Request, res: Response) => {
  const { agentId, marketId = 'test_market', side = 'BUY', outcome = 'YES', amount = 10, price = 0.5 } = req.body ?? {};
  if (!agentId) {
    res.status(400).json({ error: 'agentId is required' });
    return;
  }

  copyEngine.processAsync({
    agentId: String(agentId),
    marketId: String(marketId),
    side: String(side),
    outcome: String(outcome),
    amount: Number(amount),
    price: Number(price),
  });

  res.json({ ok: true, queued: true });
});

export default router;
