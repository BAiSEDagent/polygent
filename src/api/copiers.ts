import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../utils/auth';
import { copierStore } from '../models/copier';
import { copyEngine } from '../core/copy-engine';

import { sanitizeObject } from '../utils/sanitize';
import { copierCreateSchema, copierTestTriggerSchema, formatZodError } from '../validation/schemas';

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
  const parsed = copierCreateSchema.safeParse(sanitizeObject(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid copier payload', details: formatZodError(parsed.error) });
    return;
  }
  const { copierAddress, agentId, fixedUsdc, apiKey, apiSecret, apiPassphrase, l2PrivateKey } = parsed.data;

  try {
    const delegation = copierStore.create({
      id: `cp_${uuid().replace(/-/g, '').slice(0, 12)}`,
      copierAddress,
      agentId,
      fixedUsdc,
      apiKey,
      apiSecret,
      apiPassphrase,
      l2PrivateKey,
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
  const parsed = copierTestTriggerSchema.safeParse(sanitizeObject(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid test trigger payload', details: formatZodError(parsed.error) });
    return;
  }
  const { agentId, marketId = 'test_market', side = 'BUY', outcome = 'YES', amount = 10, price = 0.5 } = parsed.data;

  copyEngine.processAsync({
    agentId,
    marketId: marketId as string,
    side: side as string,
    outcome: outcome as string,
    amount: amount as number,
    price: price as number,
  });

  res.json({ ok: true, queued: true });
});

export default router;
