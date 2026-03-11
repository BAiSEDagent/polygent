import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { buildHmacSignature, BuilderApiKeyCreds } from '@polymarket/builder-signing-sdk';
import { logger } from '../utils/logger';
import { config } from '../config';

import { sanitizeObject } from '../utils/sanitize';
import { builderSignSchema, formatZodError } from '../validation/schemas';

/**
 * POST /sign — Remote Builder Signing Endpoint
 *
 * External agents' CLOB clients point their BuilderConfig here:
 *   new BuilderConfig({ remoteBuilderConfig: { url: "https://polygent.market/sign" } })
 *
 * The client SDK sends { method, path, body } and we return signed
 * POLY_BUILDER_* headers. The agent never sees our builder credentials.
 *
 * This is the "toll booth" — every order placed through this endpoint
 * is automatically attributed to Polygent for builder fee revenue.
 */

const router = Router();

// Rate limit: 120 sign requests/min per IP (each order triggers one sign call)
const signRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  message: { error: 'Sign endpoint rate limit exceeded — max 120/min' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Optional auth token for sign endpoint (set SIGN_AUTH_TOKEN in .env to require it)
const authToken = process.env.SIGN_AUTH_TOKEN;

router.post('/', signRateLimit, async (req: Request, res: Response) => {
  // Optional token auth
  if (authToken) {
    const provided = req.headers.authorization?.replace('Bearer ', '');
    if (provided !== authToken) {
      res.status(401).json({ error: 'Invalid or missing auth token' });
      return;
    }
  }

  const parsed = builderSignSchema.safeParse(sanitizeObject(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid sign request', details: formatZodError(parsed.error) });
    return;
  }
  const { method, path, body } = parsed.data;

  // FAILSAFE: refuse to sign if builder creds aren't configured
  if (!config.BUILDER_API_KEY || !config.BUILDER_SECRET || !config.BUILDER_PASSPHRASE) {
    logger.error('Builder credentials not configured — refusing to sign');
    res.status(500).json({ error: 'Builder signing not available' });
    return;
  }

  try {
    const timestamp = Date.now().toString();

    const signature = buildHmacSignature(
      config.BUILDER_SECRET,
      parseInt(timestamp),
      method,
      path,
      typeof body === 'string' ? body : JSON.stringify(body ?? ''),
    );

    const headers = {
      POLY_BUILDER_SIGNATURE: signature,
      POLY_BUILDER_TIMESTAMP: timestamp,
      POLY_BUILDER_API_KEY: config.BUILDER_API_KEY,
      POLY_BUILDER_PASSPHRASE: config.BUILDER_PASSPHRASE,
    };

    logger.debug('Builder sign request', { method, path: path.slice(0, 50) });

    res.json(headers);
  } catch (err) {
    logger.error('Builder signing failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Signing failed' });
  }
});

export default router;
