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

/** 
 * Timing-safe comparison for admin keys — constant time regardless of length.
 * SECURITY: Pads inputs to eliminate length-based timing oracles before hashing.
 */
function safeCompareKeys(provided: string, expected: string): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  
  // Enforce minimum length to prevent trivial brute force
  if (provided.length < 32 || expected.length < 32) {
    return false;
  }
  
  // Pad both to same length before hashing (eliminates length timing oracle)
  const maxLen = Math.max(provided.length, expected.length, 64);
  const paddedA = provided.padEnd(maxLen, '\0');
  const paddedB = expected.padEnd(maxLen, '\0');
  
  // Hash both values so comparison is always fixed-length (32 bytes)
  const hashA = crypto.createHash('sha256').update(paddedA).digest();
  const hashB = crypto.createHash('sha256').update(paddedB).digest();
  
  return crypto.timingSafeEqual(hashA, hashB);
}

/** Middleware: authenticate admin by X-Admin-Key header (ONLY - no agent fallback) */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminKey = req.header('X-Admin-Key');
  if (!adminKey) {
    res.status(401).json({ error: 'Missing X-Admin-Key header' });
    return;
  }

  const { config } = require('../config');
  if (!safeCompareKeys(adminKey, config.ADMIN_API_KEY)) {
    logger.warn('Admin authentication failed');
    res.status(401).json({ error: 'Invalid admin key' });
    return;
  }

  (req as any).isAdmin = true;
  next();
}

// NOTE: authenticateAdmin with agent fallback was REMOVED (security risk — privilege escalation vector).
// Use requireAdmin for admin routes, authenticateAgent for agent routes. Never mix auth levels.
