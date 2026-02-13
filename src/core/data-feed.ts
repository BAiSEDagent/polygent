import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { gammaClient } from './gamma';
import { WSMessage } from '../utils/types';
import { hashApiKey } from '../utils/auth';
import { agentStore } from '../models/agent';

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
  ip: string;
  authenticated: boolean;
  agentId?: string;
}

// Connection limits
const MAX_CONNECTIONS = 100;
const MAX_CONNECTIONS_PER_IP = 5;
const MAX_SUBSCRIPTIONS_PER_CLIENT = 50;
const MAX_WS_MESSAGE_SIZE = 4096;
const VALID_CHANNEL_PATTERN = /^(markets|trades|prices:[a-zA-Z0-9_-]+)$/;

let wss: WebSocketServer;
const clients = new Map<WebSocket, ClientState>();
const connectionsByIp = new Map<string, number>();
let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function initDataFeed(server: Server): WebSocketServer {
  wss = new WebSocketServer({ 
    server, 
    path: '/ws/feed',
    verifyClient: (info: { req: any }) => {
      const clientIp = info.req.socket.remoteAddress || 'unknown';
      
      // Check global connection limit
      if (clients.size >= MAX_CONNECTIONS) {
        logger.warn(`WebSocket connection rejected: global limit exceeded (${MAX_CONNECTIONS})`);
        return false;
      }
      
      // Check per-IP connection limit
      const ipConnections = connectionsByIp.get(clientIp) || 0;
      if (ipConnections >= MAX_CONNECTIONS_PER_IP) {
        logger.warn(`WebSocket connection rejected: IP limit exceeded`, { ip: clientIp });
        return false;
      }
      
      return true;
    }
  });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const state: ClientState = { 
      subscriptions: new Set(), 
      alive: true,
      ip: clientIp,
      authenticated: false
    };
    
    clients.set(ws, state);
    
    // Update IP connection count
    connectionsByIp.set(clientIp, (connectionsByIp.get(clientIp) || 0) + 1);
    
    logger.info(`WebSocket client connected from ${clientIp} (total: ${clients.size})`);

    ws.on('message', (raw: Buffer) => {
      if (raw.length > MAX_WS_MESSAGE_SIZE) {
        sendToClient(ws, { type: 'error', error: `Message too large (max ${MAX_WS_MESSAGE_SIZE} bytes)` });
        ws.close(1009, 'Message too large');
        return;
      }
      try {
        const msg = JSON.parse(raw.toString()) as WSMessage;
        handleClientMessage(ws, state, msg);
      } catch (e) {
        sendToClient(ws, { type: 'error', error: 'Invalid JSON' });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      
      // Update IP connection count
      const currentCount = connectionsByIp.get(clientIp) || 0;
      if (currentCount <= 1) {
        connectionsByIp.delete(clientIp);
      } else {
        connectionsByIp.set(clientIp, currentCount - 1);
      }
      
      logger.info(`WebSocket client disconnected from ${clientIp} (total: ${clients.size})`);
    });

    ws.on('pong', () => {
      state.alive = true;
    });

    // Send welcome message
    sendToClient(ws, {
      type: 'market_update',
      data: { 
        message: 'Connected to Cogent data feed. Authenticate with {"type":"auth","token":"your_api_key"} to access protected channels.',
        channels: [] 
      },
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

function handleClientMessage(ws: WebSocket, state: ClientState, msg: any): void {
  switch (msg.type) {
    case 'auth':
      // Authenticate client with API key
      if (typeof msg.token === 'string' && msg.token.length > 0) {
        const hash = hashApiKey(msg.token);
        const agent = agentStore.findByApiKeyHash(hash);
        
        if (agent && agent.status === 'active') {
          state.authenticated = true;
          state.agentId = agent.id;
          sendToClient(ws, {
            type: 'market_update',
            data: { authenticated: true, agentId: agent.id },
          });
          logger.debug(`WebSocket client authenticated`, { agentId: agent.id, ip: state.ip });
        } else {
          sendToClient(ws, { type: 'error', error: 'Invalid authentication token' });
        }
      } else {
        sendToClient(ws, { type: 'error', error: 'Authentication token required' });
      }
      break;

    case 'subscribe':
      if (msg.channels) {
        const allowedChannels: string[] = [];
        
        for (const ch of msg.channels) {
          // Validate channel name
          if (typeof ch !== 'string' || !VALID_CHANNEL_PATTERN.test(ch)) {
            sendToClient(ws, {
              type: 'error',
              error: `Invalid channel name: '${ch}'. Must be 'markets', 'trades', or 'prices:<id>'`
            });
            continue;
          }

          // Check subscription limit
          if (!state.subscriptions.has(ch) && state.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
            sendToClient(ws, {
              type: 'error',
              error: `Subscription limit reached (max ${MAX_SUBSCRIPTIONS_PER_CLIENT})`
            });
            break;
          }

          // Check if channel requires authentication
          if (ch === 'trades') {
            if (!state.authenticated) {
              sendToClient(ws, { 
                type: 'error', 
                error: `Channel '${ch}' requires authentication` 
              });
              continue;
            }
          }
          
          state.subscriptions.add(ch);
          allowedChannels.push(ch);
        }
        
        if (allowedChannels.length > 0) {
          sendToClient(ws, {
            type: 'market_update',
            data: { subscribed: allowedChannels },
          });
          logger.debug(`Client subscribed to: ${allowedChannels.join(', ')}`, { 
            ip: state.ip,
            authenticated: state.authenticated 
          });
        }
      }
      break;

    case 'unsubscribe':
      if (msg.channels) {
        for (const ch of msg.channels) {
          state.subscriptions.delete(ch);
        }
        sendToClient(ws, {
          type: 'market_update',
          data: { unsubscribed: msg.channels },
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
