import { config } from '../config';
import { logger } from '../utils/logger';
import { Order, OrderRequest, OrderSide, OrderOutcome } from '../utils/types';
import { deployProxyWallet, signOrder } from './wallet';

/**
 * CLOB client — wraps Polymarket's CLOB REST API.
 * Every request includes the builderId header for attribution.
 */

interface CLOBOrderPayload {
  tokenID: string;
  price: string;
  size: string;
  side: string;
  feeRateBps: string;
  nonce: string;
  expiration: string;
  taker: string;
  maker: string;
  signatureType: number;
  signature: string;
}

class CLOBClient {
  private baseUrl: string;
  private builderId: string;
  private builderApiKey: string;

  constructor() {
    this.baseUrl = config.POLYMARKET_CLOB_URL;
    this.builderId = config.BUILDER_ID;
    this.builderApiKey = config.BUILDER_API_KEY;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Builder-Id': this.builderId,
      ...(this.builderApiKey ? { Authorization: `Bearer ${this.builderApiKey}` } : {}),
    };
  }

  /** Fetch current orderbook for a token */
  async getOrderbook(tokenId: string): Promise<{
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
  }> {
    const url = `${this.baseUrl}/book?token_id=${tokenId}`;
    logger.debug(`Fetching orderbook for ${tokenId}`);

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(`CLOB orderbook error: ${response.status} ${await response.text()}`);
    }
    return response.json() as any;
  }

  /** Get best bid/ask for a token */
  async getMidpoint(tokenId: string): Promise<number> {
    const book = await this.getOrderbook(tokenId);
    const bestBid = book.bids.length > 0 ? parseFloat(book.bids[0].price) : 0;
    const bestAsk = book.asks.length > 0 ? parseFloat(book.asks[0].price) : 1;
    return (bestBid + bestAsk) / 2;
  }

  /** Place an order on the CLOB */
  async placeOrder(
    agentId: string,
    request: OrderRequest,
    maxSlippage: number = 0.02 // Default 2% slippage protection
  ): Promise<{ orderId: string; status: string }> {
    // Ensure proxy wallet is deployed
    const proxyWallet = await deployProxyWallet(agentId);

    // Check slippage protection for limit orders
    if (request.type !== 'MARKET') {
      try {
        const currentMidpoint = await this.getMidpoint(request.marketId);
        const priceDiff = Math.abs(request.price - currentMidpoint);
        const slippagePct = priceDiff / currentMidpoint;
        
        if (slippagePct > maxSlippage) {
          throw new Error(
            `Order rejected: price ${request.price} differs by ${(slippagePct * 100).toFixed(2)}% ` +
            `from current midpoint ${currentMidpoint.toFixed(4)}, exceeds max slippage of ${(maxSlippage * 100).toFixed(2)}%`
          );
        }
        
        logger.debug(`Slippage check passed`, {
          agentId,
          requestedPrice: request.price,
          currentMidpoint,
          slippagePct: (slippagePct * 100).toFixed(2) + '%',
          maxSlippage: (maxSlippage * 100).toFixed(2) + '%'
        });
      } catch (slippageError) {
        const error = slippageError as Error;
        if (error.message && error.message.includes('Order rejected: price')) {
          throw error; // Re-throw slippage rejections
        }
        // If we can't get current price, reject the order — safety fails closed
        logger.error('Cannot verify slippage protection — rejecting order for safety', {
          agentId,
          error: error.message || 'Unknown error'
        });
        throw new Error('Order rejected: unable to verify slippage protection. Market data unavailable.');
      }
    }

    logger.info(`Placing order on CLOB`, {
      agentId,
      marketId: request.marketId,
      side: request.side,
      outcome: request.outcome,
      amount: request.amount,
      price: request.price,
    });

    // Build the order payload
    const nonce = Date.now().toString();
    const expiration = (Math.floor(Date.now() / 1000) + 86400).toString(); // 24h

    // EIP-712 domain for Polymarket CLOB
    const EXCHANGE_CONTRACT = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
    const domain = {
      name: 'Polymarket CTF Exchange',
      version: '1',
      chainId: 137, // Polygon
      verifyingContract: EXCHANGE_CONTRACT,
    };

    const types = {
      Order: [
        { name: 'salt', type: 'uint256' },
        { name: 'maker', type: 'address' },
        { name: 'signer', type: 'address' },
        { name: 'taker', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'makerAmount', type: 'uint256' },
        { name: 'takerAmount', type: 'uint256' },
        { name: 'expiration', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'feeRateBps', type: 'uint256' },
        { name: 'side', type: 'uint8' },
        { name: 'signatureType', type: 'uint8' },
      ],
    };

    // For BUY: makerAmount = USDC spent, takerAmount = outcome tokens received
    // For SELL: makerAmount = outcome tokens sold, takerAmount = USDC received
    // Price is in USDC per outcome token (0-1 range)
    const isBuy = request.side === 'BUY';
    const usdcAmount = Math.floor(request.amount * 1e6); // USDC 6 decimals
    const outcomeAmount = Math.floor((request.amount / request.price) * 1e6);
    
    const makerAmount = isBuy ? usdcAmount.toString() : outcomeAmount.toString();
    const takerAmount = isBuy ? outcomeAmount.toString() : usdcAmount.toString();

    // Get the EOA wallet address (signer) — distinct from proxy (maker)
    const { getAgentWallet } = await import('./wallet');
    const eoaWallet = getAgentWallet(agentId);
    if (!eoaWallet) throw new Error(`No wallet found for agent ${agentId}`);

    const value = {
      salt: nonce,
      maker: proxyWallet,                                    // CRITICAL: Proxy address (Gnosis Safe)
      signer: eoaWallet.address,                             // CRITICAL: EOA that signs
      taker: '0x0000000000000000000000000000000000000000',    // Open order
      tokenId: request.marketId,
      makerAmount,
      takerAmount,
      expiration,
      nonce,
      feeRateBps: '0',
      side: isBuy ? 0 : 1,
      signatureType: 0,                                      // 0 = EOA signature
    };

    // Sign the order
    const signature = await signOrder(agentId, domain, types, value);

    // Submit to CLOB
    const payload = {
      order: {
        ...value,
        signature,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/order`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`CLOB order placement failed: ${response.status}`, { error: errorText });
        throw new Error(`CLOB error ${response.status}: ${errorText}`);
      }

      const result = (await response.json()) as { orderID: string; status: string };
      logger.info(`Order placed successfully`, {
        agentId,
        clobOrderId: result.orderID,
        status: result.status,
      });

      return { orderId: result.orderID, status: result.status };
    } catch (error) {
      // For development: return a mock response (tagged as mock)
      if (config.NODE_ENV === 'development') {
        const mockId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        logger.warn(`CLOB unavailable in dev mode, returning mock order`, { mockId });
        return { orderId: mockId, status: 'open', source: 'mock' as const };
      }
      throw error;
    }
  }

  /** Cancel an order on the CLOB */
  async cancelOrder(clobOrderId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/order/${clobOrderId}`, {
        method: 'DELETE',
        headers: this.headers(),
      });

      if (!response.ok) {
        logger.error(`Failed to cancel order ${clobOrderId}: ${response.status}`);
        return false;
      }

      logger.info(`Order cancelled: ${clobOrderId}`);
      return true;
    } catch (error) {
      if (config.NODE_ENV === 'development') {
        logger.warn(`CLOB unavailable in dev mode, mock cancelling ${clobOrderId}`);
        return true;
      }
      throw error;
    }
  }

  /** Get open orders for a proxy wallet */
  async getOpenOrders(proxyWallet: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/orders?maker=${proxyWallet}&status=open`,
        { headers: this.headers() }
      );
      if (!response.ok) return [];
      return (await response.json()) as any[];
    } catch {
      return [];
    }
  }
}

export const clobClient = new CLOBClient();
