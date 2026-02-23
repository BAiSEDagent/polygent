import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { ethers } from 'ethers';
import rateLimit from 'express-rate-limit';
import { agentStore } from '../models/agent';
import { generateWallet } from '../core/wallet';
import { generateApiKey, hashApiKey, requireAdmin } from '../utils/auth';
import { logger } from '../utils/logger';
import { tradeStore } from '../models/trade';
import { AgentCreateRequest, AgentCreateResponse } from '../utils/types';

const router = Router();

// Agent registration rate limit: 5 registrations per hour per IP
const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Agent registration rate limit exceeded. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// External registration rate limit: 3 per hour per IP (more conservative — public endpoint)
const externalRegistrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Registration rate limit exceeded. Try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Max agent count limit
const MAX_AGENT_COUNT = 100;

/**
 * POST /api/agents/register — External agent self-onboarding.
 *
 * Public endpoint — no admin key needed. Developers call this once to get
 * a Polygent API key linked to their own wallets. After registration they can:
 *  - POST signed orders to /api/orders/relay (supply side)
 *  - Appear on the Polygent leaderboard immediately
 *
 * Body:
 *   name        — display name shown on Leaderboard (required)
 *   description — short bio, e.g. "Mean-reversion bot on BTC/ETH markets"
 *   strategy    — strategy category label
 *   eoaAddress  — EOA that signs EIP-712 order payloads (used for /relay verification)
 *   proxyAddress — Polymarket Gnosis Safe / proxy wallet that holds USDC and is the order maker
 *
 * Returns (API key shown ONCE — store it securely):
 *   { agentId, apiKey, eoaAddress, proxyAddress, leaderboardUrl, relayEndpoint }
 */
router.post('/register', externalRegistrationRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, description, strategy, eoaAddress, proxyAddress } = req.body as {
      name?: string;
      description?: string;
      strategy?: string;
      eoaAddress?: string;
      proxyAddress?: string;
    };

    // ── Input validation ──────────────────────────────────────────────────────
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const cleanName = name.replace(/<[^>]*>/g, '').trim().slice(0, 100);
    if (!cleanName) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }

    if (!eoaAddress || !ethers.utils.isAddress(eoaAddress)) {
      res.status(400).json({ error: 'eoaAddress is required and must be a valid Ethereum address' });
      return;
    }

    if (!proxyAddress || !ethers.utils.isAddress(proxyAddress)) {
      res.status(400).json({ error: 'proxyAddress is required and must be a valid Ethereum address (your Polymarket proxy/Gnosis Safe wallet)' });
      return;
    }

    // EOA and proxy must be different — if they match the dev likely doesn't have a proxy deployed
    if (eoaAddress.toLowerCase() === proxyAddress.toLowerCase()) {
      res.status(400).json({
        error: 'eoaAddress and proxyAddress must be different. proxyAddress is your Polymarket Gnosis Safe / proxy wallet (not your signing EOA). See docs for how to deploy a proxy wallet.',
      });
      return;
    }

    if (agentStore.count() >= MAX_AGENT_COUNT) {
      res.status(429).json({ error: `Agent capacity reached. Contact support.` });
      return;
    }

    // Duplicate name check
    const duplicate = agentStore.list().find((a) => a.name.toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      res.status(409).json({ error: `Agent name '${cleanName}' is already taken` });
      return;
    }

    // Duplicate EOA check — one registration per EOA
    const existingEoa = agentStore.list().find(
      (a) => a.walletAddress?.toLowerCase() === eoaAddress.toLowerCase()
    );
    if (existingEoa) {
      res.status(409).json({ error: 'An agent with this EOA address is already registered' });
      return;
    }

    // ── Create agent ──────────────────────────────────────────────────────────
    const apiKey  = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const id = `ext_${uuid().replace(/-/g, '').slice(0, 12)}`;

    const cleanDesc = description
      ? String(description).replace(/<[^>]*>/g, '').trim().slice(0, 500)
      : undefined;
    const cleanStrategy = strategy
      ? String(strategy).replace(/<[^>]*>/g, '').trim().slice(0, 100)
      : undefined;

    // External agents bring their own wallets — no internal key stored.
    // walletAddress = EOA (used by /relay for EIP-712 verification)
    // proxyWallet   = Gnosis Safe (the maker address in CLOB orders)
    const agent = agentStore.createExternal({
      id,
      name: cleanName,
      description: cleanDesc,
      strategy: cleanStrategy,
      apiKeyHash,
      walletAddress: ethers.utils.getAddress(eoaAddress),   // checksummed
      proxyWallet:   ethers.utils.getAddress(proxyAddress),  // checksummed
    });

    logger.info('External agent registered', {
      agentId: agent.id,
      name: agent.name,
      eoaAddress: agent.walletAddress,
      proxyWallet: agent.proxyWallet,
    });

    res.status(201).json({
      agentId: agent.id,
      name: agent.name,
      // API key is returned ONCE. It is never stored in plaintext. If lost, register again.
      apiKey,
      eoaAddress:   agent.walletAddress,
      proxyAddress: agent.proxyWallet,
      leaderboardUrl: `https://polygent.market/leaderboard#${agent.id}`,
      relayEndpoint:  'https://polygent.market/api/orders/relay',
      message: 'Registration successful. Store your apiKey securely — it will not be shown again.',
    });
  } catch (err) {
    logger.error('External agent registration failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/agents — Register a new internal agent (requires admin API key) */
router.post('/', registrationRateLimit, requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body as AgentCreateRequest;

    if (!body.name || typeof body.name !== 'string') {
      res.status(400).json({ error: 'name is required (string)' });
      return;
    }

    const name = body.name.replace(/<[^>]*>/g, '').trim().slice(0, 100);
    const description = body.description
      ? String(body.description).replace(/<[^>]*>/g, '').trim().slice(0, 500)
      : undefined;
    const strategy = body.strategy
      ? String(body.strategy).replace(/<[^>]*>/g, '').trim().slice(0, 100)
      : undefined;

    if (!name) {
      res.status(400).json({ error: 'name cannot be empty after sanitization' });
      return;
    }

    if (agentStore.count() >= MAX_AGENT_COUNT) {
      res.status(429).json({ error: `Maximum agent limit of ${MAX_AGENT_COUNT} reached` });
      return;
    }

    const existing = agentStore.list().find((a) => a.name === name);
    if (existing) {
      res.status(409).json({ error: `Agent with name '${name}' already exists` });
      return;
    }

    const wallet = generateWallet();
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const id = `agent_${uuid().replace(/-/g, '').slice(0, 12)}`;

    const agent = agentStore.create({
      id,
      name,
      description,
      strategy,
      apiKeyHash,
      privateKey: wallet.privateKey,
      walletAddress: wallet.address,
      configOverrides: body.config,
      deposit: body.deposit,
      registeredViaApi: true,
    });

    logger.info(`Agent registered: ${agent.id} (${agent.name})`, {
      agentId: agent.id,
      wallet: agent.walletAddress,
    });

    const response: AgentCreateResponse = {
      id: agent.id,
      name: agent.name,
      apiKey,
      walletAddress: agent.walletAddress,
      status: agent.status,
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to register agent', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/agents — List all agents (admin only) */
router.get('/', requireAdmin, (_req: Request, res: Response) => {
  const agents = agentStore.list().map((a) => ({
    id: a.id,
    name: a.name,
    walletAddress: a.walletAddress,
    proxyWallet: a.proxyWallet,
    status: a.status,
    equity: a.equity,
    config: a.config,
    createdAt: a.createdAt,
  }));
  res.json({ agents, total: agents.length });
});

/** GET /api/agents/:id — Get agent details (admin only) */
router.get('/:id', requireAdmin, (req: Request, res: Response) => {
  const agent = agentStore.get(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({
    id: agent.id,
    name: agent.name,
    walletAddress: agent.walletAddress,
    proxyWallet: agent.proxyWallet,
    status: agent.status,
    equity: agent.equity,
    config: agent.config,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  });
});

/** DELETE /api/agents/:id — Deactivate agent (admin only) */
router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  const agent = agentStore.deactivate(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  logger.info(`Agent deactivated: ${agent.id}`, { agentId: agent.id });
  res.json({ id: agent.id, status: agent.status, message: 'Agent deactivated' });
});

/** POST /api/agents/:id/reset — Reset circuit breaker (admin only) */
router.post('/:id/reset', requireAdmin, (req: Request, res: Response) => {
  const agent = agentStore.resetCircuitBreak(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found or not in circuit_break state' });
    return;
  }
  logger.info(`Circuit breaker reset for agent ${agent.id}`, { agentId: agent.id });
  res.json({ id: agent.id, status: agent.status, message: 'Circuit breaker reset' });
});

/**
 * POST /api/agents/onboard — Full agent onboarding (deploy Safe + approvals + derive CLOB creds)
 *
 * Body: { privateKey: "0x..." }
 *
 * ⚠️ SECURITY: This endpoint receives the agent's private key to deploy their Safe.
 * The key is used transiently and NEVER stored. In production, this should be
 * replaced with a client-side flow where the agent signs locally.
 *
 * For now, this enables server-side onboarding for AI agents that trust Polygent.
 */
router.post('/onboard', async (req: Request, res: Response) => {
  const { privateKey, name } = req.body as { privateKey?: string; name?: string };

  if (!privateKey || !privateKey.startsWith('0x')) {
    res.status(400).json({ error: 'privateKey (hex, 0x-prefixed) is required' });
    return;
  }

  try {
    const { onboardAgent } = await import('../core/agent-onboard');
    const result = await onboardAgent(privateKey as `0x${string}`);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    // Register the agent in our system
    const { Wallet } = await import('ethers');
    const wallet = new Wallet(privateKey);

    const agent = agentStore.register({
      name: name || `Agent ${wallet.address.slice(0, 8)}`,
      description: 'Onboarded via Polygent builder relay',
      walletAddress: wallet.address,
      proxyWallet: result.safeAddress!,
      deposit: 0,
      config: {},
      interval: 0,
      strategy: 'external',
      version: '1.0.0',
    });

    logger.info('Agent onboarded successfully', {
      agentId: agent.id,
      safe: result.safeAddress,
    });

    res.status(201).json({
      agentId: agent.id,
      apiKey: agent.apiKey,
      safeAddress: result.safeAddress,
      approvalsTxHash: result.approvalsTxHash,
      clobCredentials: result.clobCreds,
      signEndpoint: 'https://polygent.market/sign',
      message: 'Agent onboarded. Deposit USDC.e to your Safe address to start trading. Use the signEndpoint in your BuilderConfig for attributed orders.',
    });
  } catch (err) {
    logger.error('Onboard failed', { error: (err as Error).message });
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
