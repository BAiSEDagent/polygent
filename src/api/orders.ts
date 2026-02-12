import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { authenticateAgent } from '../utils/auth';
import { logger } from '../utils/logger';
import { evaluateRisk } from '../core/risk';
import { clobClient } from '../core/clob';
import { tradeStore } from '../models/trade';
import { agentStore } from '../models/agent';
import { broadcastTrade } from '../core/data-feed';
import { Agent, Order, OrderRequest, Trade } from '../utils/types';

const router = Router();

/** POST /api/orders — Place an order */
router.post('/', authenticateAgent, async (req: Request, res: Response) => {
  const agent = (req as any).agent as Agent;
  const body = req.body as OrderRequest;

  // Validate request
  const validation = validateOrderRequest(body);
  if (validation) {
    res.status(400).json({ error: validation });
    return;
  }

  // Run risk checks
  const riskResult = evaluateRisk(agent, body);
  if (!riskResult.approved) {
    logger.warn(`Order rejected by risk engine`, {
      agentId: agent.id,
      rule: (riskResult as any).rule,
      reason: (riskResult as any).reason,
    });
    res.status(403).json({
      error: 'Order rejected by risk engine',
      rule: (riskResult as any).rule,
      reason: (riskResult as any).reason,
    });
    return;
  }

  // Create order record
  const orderId = `ord_${uuid().replace(/-/g, '').slice(0, 16)}`;
  const order: Order = {
    id: orderId,
    agentId: agent.id,
    marketId: body.marketId,
    side: body.side,
    outcome: body.outcome,
    amount: body.amount,
    price: body.price,
    type: body.type ?? 'LIMIT',
    status: 'pending',
    filledAmount: 0,
    clobOrderId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  tradeStore.addOrder(order);

  try {
    // Submit to CLOB
    const result = await clobClient.placeOrder(agent.id, body);

    // Update order with CLOB response
    tradeStore.updateOrder(orderId, {
      clobOrderId: result.orderId,
      status: 'open',
    });

    // Record trade
    const trade: Trade = {
      id: `trd_${uuid().replace(/-/g, '').slice(0, 16)}`,
      orderId,
      agentId: agent.id,
      marketId: body.marketId,
      side: body.side,
      outcome: body.outcome,
      amount: body.amount,
      price: body.price,
      timestamp: Date.now(),
    };
    tradeStore.addTrade(trade);

    // Broadcast trade event
    broadcastTrade({
      agentId: agent.id,
      marketId: body.marketId,
      side: body.side,
      outcome: body.outcome,
      amount: body.amount,
      price: body.price,
    });

    logger.info(`Order placed: ${orderId}`, {
      agentId: agent.id,
      clobOrderId: result.orderId,
    });

    res.status(201).json({
      orderId,
      clobOrderId: result.orderId,
      status: 'open',
    });
  } catch (error) {
    tradeStore.updateOrder(orderId, { status: 'rejected' });
    logger.error(`Order submission failed`, {
      agentId: agent.id,
      orderId,
      error: (error as Error).message,
    });
    res.status(502).json({ error: 'Failed to submit order to CLOB' });
  }
});

/** DELETE /api/orders/:id — Cancel an order */
router.delete('/:id', authenticateAgent, async (req: Request, res: Response) => {
  const agent = (req as any).agent as Agent;
  const order = tradeStore.getOrder(req.params.id);

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (order.agentId !== agent.id) {
    res.status(403).json({ error: 'Not authorized to cancel this order' });
    return;
  }

  if (order.status !== 'open' && order.status !== 'pending') {
    res.status(400).json({ error: `Cannot cancel order in '${order.status}' state` });
    return;
  }

  if (order.clobOrderId) {
    const cancelled = await clobClient.cancelOrder(order.clobOrderId);
    if (!cancelled) {
      res.status(502).json({ error: 'Failed to cancel order on CLOB' });
      return;
    }
  }

  tradeStore.updateOrder(order.id, { status: 'cancelled' });
  logger.info(`Order cancelled: ${order.id}`, { agentId: agent.id });
  res.json({ orderId: order.id, status: 'cancelled' });
});

/** GET /api/orders — List orders for the authenticated agent */
router.get('/', authenticateAgent, (req: Request, res: Response) => {
  const agent = (req as any).agent as Agent;
  const status = req.query.status as string | undefined;
  const orders = tradeStore.getAgentOrders(agent.id, status as any);
  res.json({ orders, total: orders.length });
});

function validateOrderRequest(body: OrderRequest): string | null {
  if (!body.marketId) return 'marketId is required';
  if (!body.side || !['BUY', 'SELL'].includes(body.side)) return 'side must be BUY or SELL';
  if (!body.outcome || !['YES', 'NO'].includes(body.outcome)) return 'outcome must be YES or NO';
  if (typeof body.amount !== 'number' || body.amount <= 0) return 'amount must be a positive number';
  if (typeof body.price !== 'number' || body.price < 0 || body.price > 1) return 'price must be between 0 and 1';
  if (body.type && !['LIMIT', 'MARKET', 'FOK'].includes(body.type)) return 'type must be LIMIT, MARKET, or FOK';
  return null;
}

export default router;
