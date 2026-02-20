import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { authenticateAgent } from '../utils/auth';
import { logger } from '../utils/logger';
import { evaluateRisk } from '../core/risk';
import { clobClient } from '../core/clob';
import { tradeStore } from '../models/trade';
import { agentStore } from '../models/agent';
import { broadcastTrade } from '../core/data-feed';
import { Agent, Order, OrderRequest, Trade, TradeSource } from '../utils/types';
import { getAgentMutex } from '../utils/mutex';
import { assertSignerIsAgent, SignedCLOBOrder } from '../utils/verify-signature';
import { copyEngine } from '../core/copy-engine';

const router = Router();

/** POST /api/orders — Place an order (internal agents) */
router.post('/', authenticateAgent, async (req: Request, res: Response) => {
  const agent = (req as any).agent as Agent;
  const body = req.body as OrderRequest;

  // Validate request
  const validation = validateOrderRequest(body);
  if (validation) {
    res.status(400).json({ error: validation });
    return;
  }

  // Acquire per-agent mutex to prevent race conditions
  const mutex = getAgentMutex(agent.id);
  await mutex.acquire();
  
  try {
    // Run risk checks under mutex protection
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

    // Determine trade source
    const { config: appConfig } = require('../config');
    const source: TradeSource = appConfig.TRADING_MODE === 'live' ? 'live' : 'paper';

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
      source,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tradeStore.addOrder(order);
    agentStore.update(agent.id, { lastActivity: Date.now() } as any);

    try {
      // Submit to CLOB with slippage protection
      const maxSlippage = typeof body.maxSlippage === 'number' ? body.maxSlippage : 0.02;
      const result = await clobClient.placeOrder(agent.id, body, maxSlippage);

      tradeStore.updateOrder(orderId, {
        clobOrderId: result.orderId,
        status: 'open',
      });

      const tradeSource: TradeSource = result.orderId.startsWith('mock_') ? 'mock' : source;
      const trade: Trade = {
        id: `trd_${uuid().replace(/-/g, '').slice(0, 16)}`,
        orderId,
        agentId: agent.id,
        marketId: body.marketId,
        side: body.side,
        outcome: body.outcome,
        amount: body.amount,
        price: body.price,
        source: tradeSource,
        timestamp: Date.now(),
      };
      tradeStore.addTrade(trade);

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
  } finally {
    mutex.release();
  }
});

/**
 * POST /api/orders/relay — External signed order relay.
 *
 * External agents (OpenClaw, etc.) sign CLOB orders locally with their own
 * EOA and wallet, then POST the pre-signed payload here. Polygent:
 *  1. Verifies the EIP-712 signature against the agent's registered EOA
 *     (anti-spoofing — prevents faking trades on behalf of a leaderboard agent)
 *  2. Injects our builder address for Polymarket volume attribution
 *  3. Forwards the verified order to the CLOB
 *  4. Records the trade for the Leaderboard + copy-trade engine
 *
 * Zero custody: the agent's USDC stays in THEIR proxy wallet at all times.
 *
 * Request body:
 *   { signedOrder: SignedCLOBOrder }
 *
 * Headers:
 *   X-API-Key: <polygent agent key>
 */
router.post('/relay', authenticateAgent, async (req: Request, res: Response) => {
  const agent = (req as any).agent as Agent;

  // External agents must have registered their EOA with Polygent
  if (!agent.walletAddress) {
    res.status(403).json({
      error: 'No registered EOA — re-register your agent with walletAddress to use the relay endpoint',
    });
    return;
  }

  const signedOrder: SignedCLOBOrder | undefined = req.body?.signedOrder;
  if (!signedOrder) {
    res.status(400).json({ error: 'signedOrder is required' });
    return;
  }

  // Validate required order fields are present
  const orderValidation = validateSignedOrder(signedOrder);
  if (orderValidation) {
    res.status(400).json({ error: orderValidation });
    return;
  }

  // ── SECURITY: cryptographic anti-spoofing check ──────────────────────────
  // Recover the EIP-712 signer from the signature and assert it matches the
  // agent's registered EOA exactly. Mismatch = spoofing attempt → 401.
  try {
    assertSignerIsAgent(signedOrder, agent.walletAddress);
  } catch (err) {
    logger.warn('Relay blocked — signer/EOA mismatch (spoofing attempt)', {
      agentId: agent.id,
      error: (err as Error).message,
    });
    res.status(401).json({
      error: 'Signature verification failed — signer does not match registered EOA',
    });
    return;
  }

  // ── Relay to CLOB with builder attribution ────────────────────────────────
  const { config: appConfig } = require('../config');

  // FAILSAFE: never route unattributed volume
  if (!appConfig.BUILDER_ADDRESS) {
    logger.error('BUILDER_ADDRESS not configured — refusing unattributed relay', { agentId: agent.id });
    res.status(500).json({ error: 'Builder attribution not configured — trade blocked' });
    return;
  }

  const payload = {
    order: signedOrder,
    // Inject Polygent's builder address — this is what earns volume attribution
    // from Polymarket's $25k/week builder fee pool on every relayed trade.
    owner: appConfig.BUILDER_ADDRESS,
  };

  const bodyStr = JSON.stringify(payload);

  try {
    const clobUrl = appConfig.POLYMARKET_CLOB_URL;
    const authHeaders = buildClobAuthHeaders(
      'POST',
      '/order',
      bodyStr,
      appConfig.BUILDER_ADDRESS,
      appConfig.BUILDER_SECRET,
      appConfig.BUILDER_PASSPHRASE,
    );

    const response = await fetch(`${clobUrl}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: bodyStr,
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error('CLOB relay failed', {
        agentId: agent.id,
        status: response.status,
        error: errText,
      });
      res.status(502).json({ error: `CLOB error ${response.status}: ${errText}` });
      return;
    }

    const result = (await response.json()) as { orderID: string; status: string };

    // ── Record trade for Leaderboard + copy-trade engine ─────────────────────
    const orderId = `ext_${uuid().replace(/-/g, '').slice(0, 16)}`;

    // Reconstruct price from EIP-712 amounts (6-decimal USDC)
    const makerAmt = Number(signedOrder.makerAmount);
    const takerAmt = Number(signedOrder.takerAmount);
    const isBuy = signedOrder.side === 0;
    const price = isBuy && takerAmt > 0
      ? makerAmt / takerAmt
      : makerAmt > 0 ? takerAmt / makerAmt : 0;
    const amount = isBuy ? makerAmt / 1e6 : takerAmt / 1e6;

    const order: Order = {
      id: orderId,
      agentId: agent.id,
      marketId: signedOrder.tokenId,
      side: isBuy ? 'BUY' : 'SELL',
      outcome: 'YES',   // External agents own their outcome context
      amount,
      price,
      type: 'LIMIT',
      status: 'open',
      filledAmount: 0,
      clobOrderId: result.orderID,
      source: 'live',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tradeStore.addOrder(order);
    agentStore.update(agent.id, { lastActivity: Date.now() } as any);

    const trade: Trade = {
      id: `trd_${uuid().replace(/-/g, '').slice(0, 16)}`,
      orderId,
      agentId: agent.id,
      marketId: signedOrder.tokenId,
      side: order.side,
      outcome: order.outcome,
      amount,
      price,
      source: 'live',
      timestamp: Date.now(),
    };
    tradeStore.addTrade(trade);

    // Broadcast — this is what the copy-trade engine will hook into
    broadcastTrade({
      agentId: agent.id,
      marketId: signedOrder.tokenId,
      side: order.side,
      outcome: order.outcome,
      amount,
      price,
    });

    // Async copy execution — never block source trade response
    copyEngine.processAsync({
      agentId: agent.id,
      marketId: signedOrder.tokenId,
      side: order.side,
      outcome: order.outcome,
      amount,
      price,
    });

    logger.info('External order relayed and attributed', {
      agentId: agent.id,
      clobOrderId: result.orderID,
      tokenId: signedOrder.tokenId,
      amount,
      price,
    });

    res.status(201).json({
      orderId,
      clobOrderId: result.orderID,
      status: result.status,
    });
  } catch (err) {
    logger.error('Relay internal error', {
      agentId: agent.id,
      error: (err as Error).message,
    });
    res.status(500).json({ error: 'Internal relay error' });
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateOrderRequest(body: OrderRequest): string | null {
  if (!body.marketId) return 'marketId is required';
  if (!body.side || !['BUY', 'SELL'].includes(body.side)) return 'side must be BUY or SELL';
  if (!body.outcome || !['YES', 'NO'].includes(body.outcome)) return 'outcome must be YES or NO';
  if (typeof body.amount !== 'number' || body.amount <= 0 || body.amount > 1_000_000) return 'amount must be between 0 and 1,000,000';
  if (typeof body.price !== 'number' || body.price < 0 || body.price > 1) return 'price must be between 0 and 1';
  if (body.type && !['LIMIT', 'MARKET', 'FOK'].includes(body.type)) return 'type must be LIMIT, MARKET, or FOK';
  if (body.maxSlippage !== undefined && (typeof body.maxSlippage !== 'number' || body.maxSlippage < 0 || body.maxSlippage > 0.50)) return 'maxSlippage must be between 0 and 0.50 (50%)';
  return null;
}

function validateSignedOrder(o: SignedCLOBOrder): string | null {
  const required = ['salt','maker','signer','taker','tokenId','makerAmount','takerAmount','expiration','nonce','feeRateBps','signature'] as const;
  for (const field of required) {
    if (!o[field]) return `signedOrder.${field} is required`;
  }
  if (typeof o.side !== 'number' || ![0, 1].includes(o.side)) return 'signedOrder.side must be 0 (BUY) or 1 (SELL)';
  if (typeof o.signatureType !== 'number') return 'signedOrder.signatureType is required';
  if (!o.signature.startsWith('0x')) return 'signedOrder.signature must be a hex string starting with 0x';
  return null;
}

/**
 * Generate Polymarket L2 HMAC-SHA256 auth headers.
 * Signature = HMAC-SHA256(timestamp + METHOD + path + body, base64(secret))
 */
function buildClobAuthHeaders(
  method: string,
  path: string,
  body: string,
  address: string,
  secret: string,
  passphrase: string,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + body;
  const key = Buffer.from(secret, 'base64');
  const signature = crypto.createHmac('sha256', key).update(message).digest('base64');

  return {
    'POLY_ADDRESS':    address,
    'POLY_SIGNATURE':  signature,
    'POLY_TIMESTAMP':  timestamp,
    'POLY_NONCE':      '0',
    'POLY_PASSPHRASE': passphrase,
  };
}

export default router;
