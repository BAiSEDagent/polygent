import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { gammaClient } from './gamma';
import { WSMessage } from '../utils/types';

/**
 * WebSocket data feed — relays market data to connected agents.
 *
 * Channels:
 * - "markets"        — All market updates (new markets, closures)
 * - "prices:<id>"    — Price ticks for a specific market
 * - "trades"         — Global trade feed (all agent activity)
 */

interface ClientState {
  subscriptions: Set<string>;
  alive: boolean;
}

let wss: WebSocketServer;
const clients = new Map<WebSocket, ClientState>();
let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function initDataFeed(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws/feed' });

  wss.on('connection', (ws: WebSocket) => {
    const state: ClientState = { subscriptions: new Set(), alive: true };
    clients.set(ws, state);
    logger.info(`WebSocket client connected (total: ${clients.size})`);

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSMessage;
        handleClientMessage(ws, state, msg);
      } catch (e) {
        sendToClient(ws, { type: 'error', error: 'Invalid JSON' });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info(`WebSocket client disconnected (total: ${clients.size})`);
    });

    ws.on('pong', () => {
      state.alive = true;
    });

    // Send welcome message
    sendToClient(ws, {
      type: 'market_update',
      data: { message: 'Connected to Cogent data feed', channels: [] },
    });
  });

  // Heartbeat — detect dead connections
  const heartbeat = setInterval(() => {
    for (const [ws, state] of clients) {
      if (!state.alive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  // Start polling Gamma API for market updates
  startMarketPolling();

  logger.info('WebSocket data feed initialized at /ws/feed');
  return wss;
}

function handleClientMessage(ws: WebSocket, state: ClientState, msg: WSMessage): void {
  switch (msg.type) {
    case 'subscribe':
      if (msg.channels) {
        for (const ch of msg.channels) {
          state.subscriptions.add(ch);
        }
        sendToClient(ws, {
          type: 'market_update',
          data: { subscribed: Array.from(state.subscriptions) },
        });
        logger.debug(`Client subscribed to: ${msg.channels.join(', ')}`);
      }
      break;

    case 'unsubscribe':
      if (msg.channels) {
        for (const ch of msg.channels) {
          state.subscriptions.delete(ch);
        }
        sendToClient(ws, {
          type: 'market_update',
          data: { subscribed: Array.from(state.subscriptions) },
        });
      }
      break;

    default:
      sendToClient(ws, { type: 'error', error: `Unknown message type: ${msg.type}` });
  }
}

function sendToClient(ws: WebSocket, msg: WSMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/** Broadcast a message to all clients subscribed to a channel */
export function broadcast(channel: string, msg: WSMessage): void {
  for (const [ws, state] of clients) {
    if (state.subscriptions.has(channel)) {
      sendToClient(ws, msg);
    }
  }
}

/** Broadcast to ALL connected clients (no subscription filter) */
export function broadcastAll(msg: WSMessage): void {
  for (const [ws] of clients) {
    sendToClient(ws, msg);
  }
}

/** Notify about a new trade (for the dashboard and subscribed agents) */
export function broadcastTrade(trade: {
  agentId: string;
  marketId: string;
  side: string;
  outcome: string;
  amount: number;
  price: number;
}): void {
  broadcast('trades', {
    type: 'trade_event',
    data: { ...trade, timestamp: Date.now() },
  });
}

/** Start polling Gamma API for market data updates */
function startMarketPolling(): void {
  if (pollingInterval) return;

  const poll = async () => {
    try {
      const markets = await gammaClient.listMarkets({ limit: 50, order: 'volume', ascending: false });

      // Broadcast to "markets" channel subscribers
      broadcast('markets', {
        type: 'market_update',
        data: markets.map((m) => ({
          id: m.id,
          question: m.question,
          outcomePrices: m.outcomePrices,
          volume: m.volume,
          active: m.active,
        })),
      });

      // Broadcast individual price ticks
      for (const market of markets) {
        broadcast(`prices:${market.id}`, {
          type: 'price_tick',
          data: {
            marketId: market.id,
            outcomePrices: market.outcomePrices,
            timestamp: Date.now(),
          },
        });
      }
    } catch (error) {
      logger.warn('Market polling failed', { error: (error as Error).message });
    }
  };

  // Initial poll
  poll();
  pollingInterval = setInterval(poll, 30_000);
  logger.info('Market data polling started (30s interval)');
}

export function stopDataFeed(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (wss) {
    wss.close();
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}
