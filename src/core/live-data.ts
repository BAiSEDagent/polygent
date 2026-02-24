import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Market } from '../utils/types';
import { gammaClient } from './gamma';
import { clobClient } from './clob';
import { safeParseFloat } from '../utils/sanitize';

/**
 * Live Data Service — real-time market data from Gamma API + CLOB WebSocket.
 *
 * Architecture:
 * - Polls Gamma API every 60s for top active markets
 * - Connects to CLOB WebSocket for real-time price updates
 * - Caches everything in memory with configurable TTL
 * - Emits events for subscribers (strategies, dashboard)
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  tokenId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: number;
  bestAsk: number;
  midpoint: number;
  spread: number;
  timestamp: number;
}

export interface LiveMarket extends Market {
  lastUpdate: number;
  priceHistory: Array<{ price: number; timestamp: number }>;
  change24h: number;
}

type LiveDataEvent =
  | { type: 'market_update'; market: LiveMarket }
  | { type: 'price_tick'; marketId: string; prices: number[]; timestamp: number }
  | { type: 'orderbook_update'; tokenId: string; orderbook: OrderBook }
  | { type: 'markets_refreshed'; count: number };

class LiveDataService extends EventEmitter {
  private marketCache = new Map<string, CacheEntry<LiveMarket>>();
  private orderbookCache = new Map<string, CacheEntry<OrderBook>>();
  private topMarkets: LiveMarket[] = [];
  private wsConnection: WebSocket | null = null;
  private wsSubscriptions = new Set<string>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private reconnectAttempts = 0;

  private readonly MARKET_TTL = 60_000;       // 60s
  private readonly ORDERBOOK_TTL = 10_000;    // 10s
  private readonly POLL_INTERVAL = 60_000;    // 60s
  private readonly WS_RECONNECT_BASE_DELAY = 1_000;  // Start at 1s
  private readonly WS_RECONNECT_MAX_DELAY = 60_000;  // Max 60s
  private readonly MAX_PRICE_HISTORY = 100;
  private readonly MAX_CACHE_SIZE = 200;
  private readonly CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

  /** Start the live data service */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    logger.info('🔴 Starting Live Data Service');

    // Initial market fetch
    await this.refreshMarkets();

    // Start polling
    this.pollInterval = setInterval(() => this.refreshMarkets(), this.POLL_INTERVAL);

    // Connect WebSocket
    this.connectWebSocket();

    logger.info(`📡 Live Data Service running — ${this.topMarkets.length} markets loaded`);
  }

  /** Stop the service */
  stop(): void {
    this.running = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    this.wsSubscriptions.clear();
    logger.info('Live Data Service stopped');
  }

  /** Get top active markets (cached) */
  getTopMarkets(limit = 20): LiveMarket[] {
    return this.topMarkets.slice(0, limit);
  }

  /** Get a specific market by ID */
  getMarket(marketId: string): LiveMarket | null {
    const entry = this.marketCache.get(marketId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.marketCache.delete(marketId);
      return null;
    }
    return entry.data;
  }

  /** Get orderbook for a token (fetches from CLOB if not cached) */
  async getOrderBook(tokenId: string): Promise<OrderBook | null> {
    const cached = this.orderbookCache.get(tokenId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const raw = await clobClient.getOrderbook(tokenId);
      const bids = raw.bids.map(l => ({ price: safeParseFloat(l.price, 0), size: safeParseFloat(l.size, 0) }));
      const asks = raw.asks.map(l => ({ price: safeParseFloat(l.price, 1), size: safeParseFloat(l.size, 0) }));
      const bestBid = bids[0]?.price ?? 0;
      const bestAsk = asks[0]?.price ?? 1;

      const orderbook: OrderBook = {
        tokenId,
        bids,
        asks,
        bestBid,
        bestAsk,
        midpoint: (bestBid + bestAsk) / 2,
        spread: bestAsk - bestBid,
        timestamp: Date.now(),
      };

      // Evict oldest if cache is too large
      if (this.orderbookCache.size >= this.MAX_CACHE_SIZE) {
        const firstKey = this.orderbookCache.keys().next().value;
        if (firstKey) this.orderbookCache.delete(firstKey);
      }
      this.orderbookCache.set(tokenId, {
        data: orderbook,
        expiresAt: Date.now() + this.ORDERBOOK_TTL,
      });

      return orderbook;
    } catch (error) {
      logger.debug(`Failed to fetch orderbook for ${tokenId}`, { error: (error as Error).message });
      return null;
    }
  }

  /** Subscribe to real-time price updates for a market's token */
  subscribeToMarket(tokenId: string): void {
    if (this.wsSubscriptions.has(tokenId)) return;
    this.wsSubscriptions.add(tokenId);

    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      this.sendWsSubscribe([tokenId]);
    }
  }

  /** Unsubscribe from a market's token */
  unsubscribeFromMarket(tokenId: string): void {
    this.wsSubscriptions.delete(tokenId);
    // CLOB WS doesn't have explicit unsubscribe — handled by reconnect
  }

  /** Get all cached market IDs */
  getCachedMarketIds(): string[] {
    return Array.from(this.marketCache.keys());
  }

  /** Get service stats */
  getStats(): {
    marketsLoaded: number;
    orderbooksCached: number;
    wsConnected: boolean;
    wsSubscriptions: number;
  } {
    return {
      marketsLoaded: this.topMarkets.length,
      orderbooksCached: this.orderbookCache.size,
      wsConnected: this.wsConnection?.readyState === WebSocket.OPEN,
      wsSubscriptions: this.wsSubscriptions.size,
    };
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async refreshMarkets(): Promise<void> {
    try {
      const markets = await gammaClient.listMarkets({
        limit: 50,
        order: 'volume',
        ascending: false,
      });

      const now = Date.now();
      const liveMarkets: LiveMarket[] = markets.map(m => {
        const existing = this.marketCache.get(m.id)?.data;
        const yesPrice = m.outcomePrices[0] ?? 0.5;

        // Build price history
        const priceHistory = existing?.priceHistory ?? [];
        priceHistory.push({ price: yesPrice, timestamp: now });
        if (priceHistory.length > this.MAX_PRICE_HISTORY) {
          priceHistory.shift();
        }

        // Calculate 24h change
        const oneDayAgo = now - 86_400_000;
        const oldEntry = priceHistory.find(p => p.timestamp >= oneDayAgo);
        const oldPrice = oldEntry?.price ?? yesPrice;
        const change24h = oldPrice > 0 ? (yesPrice - oldPrice) / oldPrice : 0;

        return {
          ...m,
          lastUpdate: now,
          priceHistory,
          change24h,
        };
      });

      // Update caches
      for (const lm of liveMarkets) {
        this.marketCache.set(lm.id, {
          data: lm,
          expiresAt: now + this.MARKET_TTL * 2, // Keep longer than poll interval
        });
      }

      this.topMarkets = liveMarkets;
      this.emit('markets_refreshed', { type: 'markets_refreshed', count: liveMarkets.length });

      logger.debug(`Markets refreshed: ${liveMarkets.length} active markets`);
    } catch (error) {
      logger.warn('Failed to refresh markets', { error: (error as Error).message });
    }
  }

  private connectWebSocket(): void {
    if (!this.running) return;

    try {
      this.wsConnection = new WebSocket(this.CLOB_WS_URL);

      this.wsConnection.on('open', () => {
        logger.info('🔌 CLOB WebSocket connected');
        this.reconnectAttempts = 0; // Reset on successful connection
        // Re-subscribe to all tracked tokens
        if (this.wsSubscriptions.size > 0) {
          this.sendWsSubscribe(Array.from(this.wsSubscriptions));
        }
      });

      this.wsConnection.on('message', (raw: Buffer) => {
        try {
          const data = JSON.parse(raw.toString());
          this.handleWsMessage(data);
        } catch {
          // Ignore malformed messages
        }
      });

      this.wsConnection.on('close', () => {
        logger.info('CLOB WebSocket disconnected');
        this.scheduleReconnect();
      });

      this.wsConnection.on('error', (err) => {
        logger.debug('CLOB WebSocket error', { error: err.message });
        this.wsConnection?.close();
      });
    } catch (error) {
      logger.debug('Failed to connect CLOB WebSocket', { error: (error as Error).message });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.running || this.reconnectTimer) return;
    
    // Exponential backoff with jitter
    const baseDelay = this.WS_RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts);
    const cappedDelay = Math.min(baseDelay, this.WS_RECONNECT_MAX_DELAY);
    const jitter = Math.random() * 1000; // Add up to 1s jitter
    const delay = cappedDelay + jitter;
    
    this.reconnectAttempts++;
    
    logger.debug(`Scheduling CLOB WS reconnect`, {
      attempt: this.reconnectAttempts,
      delayMs: Math.round(delay)
    });
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  private sendWsSubscribe(tokenIds: string[]): void {
    if (this.wsConnection?.readyState !== WebSocket.OPEN) return;

    // CLOB WS subscription format
    for (const tokenId of tokenIds) {
      const msg = JSON.stringify({
        type: 'market',
        assets_id: tokenId,
      });
      this.wsConnection.send(msg);
    }

    logger.debug(`Subscribed to ${tokenIds.length} CLOB WS channels`);
  }

  private handleWsMessage(data: any): void {
    // CLOB WS sends price updates in various formats
    if (data.event_type === 'book' || data.event_type === 'price_change') {
      const tokenId = data.asset_id ?? data.market;
      if (!tokenId) return;

      // Update orderbook cache if we have price data
      if (data.price !== undefined) {
        const price = safeParseFloat(data.price, 0.5);
        const prices = [price, 1 - price];
        this.emit('price_tick', {
          type: 'price_tick',
          marketId: tokenId,
          prices,
          timestamp: Date.now(),
        });
      }

      // Update the corresponding market's price if we can find it
      for (const [id, entry] of this.marketCache) {
        if (entry.data.conditionId === tokenId || entry.data.questionId === tokenId) {
          if (data.price !== undefined) {
            const price = safeParseFloat(data.price, 0.5);
            entry.data.outcomePrices = [price, 1 - price];
            entry.data.lastUpdate = Date.now();
            entry.data.priceHistory.push({
              price,
              timestamp: Date.now(),
            });
            if (entry.data.priceHistory.length > this.MAX_PRICE_HISTORY) {
              entry.data.priceHistory.shift();
            }

            this.emit('market_update', { type: 'market_update', market: entry.data });
          }
          break;
        }
      }
    }

    // Handle trade events
    if (data.event_type === 'last_trade_price' || data.event_type === 'tick') {
      const tokenId = data.asset_id ?? data.market;
      if (tokenId && data.price !== undefined) {
        this.emit('price_tick', {
          type: 'price_tick',
          marketId: tokenId,
          prices: [safeParseFloat(data.price, 0.5)],
          timestamp: Date.now(),
        });
      }
    }
  }
}

// Singleton
export const liveDataService = new LiveDataService();
