import { ClobClient, Side } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { logger } from '../utils/logger';

// Builder signing SDK — optional, for order attribution
let BuilderConfig: any;
let BuilderApiKeyCreds: any;
try {
  const sdk = require('@polymarket/builder-signing-sdk');
  BuilderConfig = sdk.BuilderConfig;
  BuilderApiKeyCreds = sdk.BuilderApiKeyCreds;
} catch {
  logger.warn('builder-signing-sdk not installed — orders will not be attributed');
}

interface LiveTraderConfig {
  pk: string;
  clobApiKey: string;
  clobSecret: string;
  clobPassphrase: string;
  chainId: number;
  host: string;
  builderApiKey?: string;
  builderSecret?: string;
  builderPassphrase?: string;
  maxOrderSize: number;    // USD
  maxTotalExposure: number; // USD
}

interface TradeResult {
  success: boolean;
  orderId?: string;
  error?: string;
  tokenId: string;
  side: string;
  price: number;
  size: number;
}

export class LiveTrader {
  private client: ClobClient;
  private config: LiveTraderConfig;
  private totalExposure: number = 0;
  private pendingExposure: number = 0; // SECURITY: Optimistic locking for concurrent orders
  private orderCount: number = 0;
  private dailyOrderCount: number = 0;
  private lastResetDay: number = new Date().getDate();

  constructor(cfg: LiveTraderConfig) {
    this.config = cfg;

    const signer = new Wallet(cfg.pk);
    const creds = {
      key: cfg.clobApiKey,
      secret: cfg.clobSecret,
      passphrase: cfg.clobPassphrase,
    };

    // Build builder config if creds available
    let builderConfig: any = undefined;
    if (cfg.builderApiKey && cfg.builderSecret && cfg.builderPassphrase && BuilderConfig) {
      const builderCreds = {
        key: cfg.builderApiKey,
        secret: cfg.builderSecret,
        passphrase: cfg.builderPassphrase,
      };
      builderConfig = new BuilderConfig({ localBuilderCreds: builderCreds });
      logger.info('Builder attribution enabled');
    }

    this.client = new ClobClient(
      cfg.host,
      cfg.chainId,
      signer,
      creds,
      0,    // EOA signature type (direct wallet signing)
      undefined, // No funder — signer is maker
      undefined,
      false,
      builderConfig
    );

    logger.info(`LiveTrader initialized — signer: ${signer.address} (EOA mode)`);
    logger.info(`Limits: $${cfg.maxOrderSize}/order, $${cfg.maxTotalExposure} total`);
  }

  /**
   * Place a real order on the CLOB.
   * All safety checks happen here — this is the single entry point for real money.
   */
  async placeOrder(params: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    tickSize?: any;
    negRisk?: boolean;
  }): Promise<TradeResult> {
    const { tokenId, side, price, size, tickSize = '0.01', negRisk = false } = params;
    const orderValue = price * size;

    // === SAFETY GATES (fail closed) ===

    // Reset daily counter
    const today = new Date().getDate();
    if (today !== this.lastResetDay) {
      this.dailyOrderCount = 0;
      this.lastResetDay = today;
    }

    // Gate 1: Order size
    if (orderValue > this.config.maxOrderSize) {
      const msg = `Order value $${orderValue.toFixed(2)} exceeds max $${this.config.maxOrderSize}`;
      logger.warn(msg);
      return { success: false, error: msg, tokenId, side, price, size };
    }

    // Gate 2: Total exposure (with optimistic locking to prevent race conditions)
    const tentativeExposure = this.totalExposure + this.pendingExposure + orderValue;
    if (tentativeExposure > this.config.maxTotalExposure) {
      const msg = `Total exposure (including pending) would be $${tentativeExposure.toFixed(2)}, exceeds max $${this.config.maxTotalExposure}`;
      logger.warn(msg);
      return { success: false, error: msg, tokenId, side, price, size };
    }
    
    // Lock exposure immediately to prevent concurrent order race
    this.pendingExposure += orderValue;

    // Gate 3: Price sanity — Polymarket requires [0.01, 0.99]
    if (price < 0.01 || price > 0.99) {
      const msg = `Invalid price ${price} — Polymarket requires 0.01–0.99`;
      logger.warn(msg);
      return { success: false, error: msg, tokenId, side, price, size };
    }

    // Gate 4: Size sanity
    if (size <= 0 || size > 10000) {
      const msg = `Invalid size ${size}`;
      logger.warn(msg);
      return { success: false, error: msg, tokenId, side, price, size };
    }

    // Gate 4b: Minimum order value — Polymarket requires >= $1.00
    if (orderValue < 1.0) {
      const msg = `Order value $${orderValue.toFixed(4)} below $1.00 minimum`;
      logger.warn(msg);
      return { success: false, error: msg, tokenId, side, price, size };
    }

    // Gate 5: Daily order cap (Unverified tier = 100/day)
    if (this.dailyOrderCount >= 90) { // Leave 10 buffer
      const msg = `Daily order limit approaching (${this.dailyOrderCount}/100)`;
      logger.warn(msg);
      return { success: false, error: msg, tokenId, side, price, size };
    }

    // Gate 6: Collateral preflight for BUY orders (avoid noisy CLOB rejects)
    if (side === 'BUY') {
      try {
        const ba = await this.client.getBalanceAllowance({ asset_type: 'COLLATERAL' } as any);
        const raw = Number(ba?.balance || 0); // USDC 6 decimals
        const required = Math.ceil(orderValue * 1_000_000);
        if (!Number.isFinite(raw) || raw < required) {
          const available = raw / 1_000_000;
          const msg = `Insufficient collateral preflight: need $${orderValue.toFixed(2)}, available $${available.toFixed(2)}`;
          logger.warn(msg);
          return { success: false, error: msg, tokenId, side, price, size };
        }
      } catch (e: any) {
        const msg = `Collateral preflight failed: ${(e?.message || 'unknown').slice(0, 120)}`;
        logger.warn(msg);
        return { success: false, error: msg, tokenId, side, price, size };
      }
    }

    // === PLACE ORDER ===
    try {
      logger.info(`Placing LIVE order: ${side} ${size} @ ${price} on ${tokenId.slice(0, 16)}...`);

      const result = await this.client.createAndPostOrder(
        {
          tokenID: tokenId,
          price: price,
          size: size,
          side: side === 'BUY' ? Side.BUY : Side.SELL,
        },
        {
          tickSize: tickSize,
          negRisk: negRisk,
        }
      );

      // CRITICAL: Check for API errors that don't throw exceptions
      if ((result as any)?.error) {
        const errMsg = (result as any).error;
        logger.error(`❌ Order failed (API error): ${errMsg}`);
        // Release pending exposure lock
        this.pendingExposure -= orderValue;
        return { success: false, error: errMsg, tokenId, side, price, size };
      }

      const orderId = result?.orderID || result?.id;
      if (!orderId) {
        logger.error(`❌ Order failed: No orderID in response`);
        // Release pending exposure lock
        this.pendingExposure -= orderValue;
        return { success: false, error: 'No orderID returned', tokenId, side, price, size };
      }

      // Only update tracking on confirmed success
      this.totalExposure += orderValue;
      this.pendingExposure -= orderValue; // Release lock (order confirmed)
      this.orderCount++;
      this.dailyOrderCount++;

      logger.info(`✅ LIVE ORDER PLACED: ${orderId} — ${side} ${size} @ ${price} ($${orderValue.toFixed(2)})`);
      logger.info(`Exposure: $${this.totalExposure.toFixed(2)}/${this.config.maxTotalExposure} | Orders today: ${this.dailyOrderCount}`);

      return {
        success: true,
        orderId,
        tokenId,
        side,
        price,
        size,
      };
    } catch (err: any) {
      // Release pending exposure lock on exception
      this.pendingExposure -= orderValue;
      
      // DO NOT update totalExposure on failure
      const errMsg = err?.message || 'Unknown error';
      // Sanitize — never log credentials
      const safeMsg = errMsg.replace(/0x[a-fA-F0-9]{64}/g, '0x***').replace(/Bearer .+/g, 'Bearer ***');
      logger.error(`❌ Order failed: ${safeMsg}`);
      return { success: false, error: safeMsg, tokenId, side, price, size };
    }
  }

  /** Get current open orders */
  async getOpenOrders() {
    return this.client.getOpenOrders();
  }

  /** Cancel an order */
  async cancelOrder(orderId: string) {
    return this.client.cancelOrder({ orderID: orderId } as any);
  }

  /** Cancel all open orders */
  async cancelAll() {
    return this.client.cancelAll();
  }

  /** Get stats */
  getStats() {
    return {
      totalExposure: this.totalExposure,
      maxExposure: this.config.maxTotalExposure,
      orderCount: this.orderCount,
      dailyOrderCount: this.dailyOrderCount,
      maxOrderSize: this.config.maxOrderSize,
    };
  }
}

// Singleton
let _liveTrader: LiveTrader | null = null;

export function initLiveTrader(): LiveTrader {
  if (_liveTrader) return _liveTrader;

  const pk = process.env.PK;
  if (!pk) throw new Error('PK not set in environment');

  _liveTrader = new LiveTrader({
    pk,
    clobApiKey: process.env.CLOB_API_KEY || '',
    clobSecret: process.env.CLOB_SECRET || '',
    clobPassphrase: process.env.CLOB_PASSPHRASE || '',
    chainId: Number(process.env.CHAIN_ID || 137),
    host: 'https://clob.polymarket.com',
    builderApiKey: process.env.BUILDER_API_KEY,
    builderSecret: process.env.BUILDER_SECRET,
    builderPassphrase: process.env.BUILDER_PASSPHRASE,
    maxOrderSize: Number(process.env.MAX_ORDER_SIZE || 5),
    maxTotalExposure: Number(process.env.MAX_TOTAL_EXPOSURE || 50),
  });

  return _liveTrader;
}

export function getLiveTrader(): LiveTrader | null {
  return _liveTrader;
}
