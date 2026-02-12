import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { agentStore } from '../models/agent';
import { generateWallet } from '../core/wallet';
import { generateApiKey, hashApiKey, authenticateAdmin } from '../utils/auth';
import { logger } from '../utils/logger';
import { AgentCreateRequest, AgentCreateResponse } from '../utils/types';

const router = Router();

/** POST /api/agents — Register a new agent (open registration for external agents) */
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as AgentCreateRequest;

    if (!body.name || typeof body.name !== 'string') {
      res.status(400).json({ error: 'name is required (string)' });
      return;
    }

    // Check for duplicate name
    const existing = agentStore.list().find((a) => a.name === body.name);
    if (existing) {
      res.status(409).json({ error: `Agent with name '${body.name}' already exists` });
      return;
    }

    // Generate wallet and API key
    const wallet = generateWallet();
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const id = `agent_${uuid().replace(/-/g, '').slice(0, 12)}`;

    const agent = agentStore.create({
      id,
      name: body.name,
      description: body.description,
      strategy: body.strategy,
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
      apiKey, // Only returned once!
      walletAddress: agent.walletAddress,
      status: agent.status,
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to register agent', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/agents — List all agents */
router.get('/', authenticateAdmin, (_req: Request, res: Response) => {
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

/** GET /api/agents/:id — Get agent details */
router.get('/:id', authenticateAdmin, (req: Request, res: Response) => {
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

/** DELETE /api/agents/:id — Deactivate agent */
router.delete('/:id', authenticateAdmin, (req: Request, res: Response) => {
  const agent = agentStore.deactivate(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  logger.info(`Agent deactivated: ${agent.id}`, { agentId: agent.id });
  res.json({ id: agent.id, status: agent.status, message: 'Agent deactivated' });
});

/** POST /api/agents/:id/reset — Reset circuit breaker */
router.post('/:id/reset', authenticateAdmin, (req: Request, res: Response) => {
  const agent = agentStore.resetCircuitBreak(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found or not in circuit_break state' });
    return;
  }
  logger.info(`Circuit breaker reset for agent ${agent.id}`, { agentId: agent.id });
  res.json({ id: agent.id, status: agent.status, message: 'Circuit breaker reset' });
});

export default router;
