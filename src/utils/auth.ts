import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from './logger';
import { agentStore } from '../models/agent';

/** Hash an API key for storage comparison */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Generate a new API key */
export function generateApiKey(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `cog_live_${random}`;
}

/** Middleware: authenticate agent by X-API-Key header */
export function authenticateAgent(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('X-API-Key');
  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  const hash = hashApiKey(apiKey);
  const agent = agentStore.findByApiKeyHash(hash);

  if (!agent) {
    logger.warn('Authentication failed: invalid API key');
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  if (agent.status === 'inactive') {
    res.status(403).json({ error: 'Agent is deactivated' });
    return;
  }

  // Attach agent to request
  (req as any).agent = agent;
  next();
}

/** Middleware: authenticate admin by X-Admin-Key header */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.header('X-Admin-Key');
  if (!adminKey) {
    // Fall back to agent auth for endpoints that accept both
    const apiKey = req.header('X-API-Key');
    if (apiKey) {
      return authenticateAgent(req, res, next);
    }
    res.status(401).json({ error: 'Missing X-Admin-Key header' });
    return;
  }

  const { config } = require('../config');
  if (adminKey !== config.ADMIN_API_KEY) {
    logger.warn('Admin authentication failed');
    res.status(401).json({ error: 'Invalid admin key' });
    return;
  }

  (req as any).isAdmin = true;
  next();
}
