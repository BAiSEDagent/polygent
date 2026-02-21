import { ClobClient, Side } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { logger } from '../utils/logger';
import { copierStore } from '../models/copier';

let BuilderConfig: any;
try {
  const sdk = require('@polymarket/builder-signing-sdk');
  BuilderConfig = sdk.BuilderConfig;
} catch {
  logger.warn('builder-signing-sdk not installed — copy attribution may fail');
}

export interface SourceTradeEvent {
  agentId: string;
  marketId: string; // tokenId in current relay flow
  side: string;
  outcome: string;
  amount: number;
  price: number;
}

class CopyEngine {
  async process(trade: SourceTradeEvent): Promise<void> {
    const copiers = copierStore.listActiveByAgentDecrypted(trade.agentId);
    if (!copiers.length) return;

    logger.info('📎 CopyEngine triggered', {
      sourceAgent: trade.agentId,
      marketId: trade.marketId,
      sourceSide: trade.side,
      sourcePrice: trade.price,
      copiers: copiers.length,
    });

    const host = process.env.POLYMARKET_CLOB_URL || 'https://clob.polymarket.com';
    const chainId = Number(process.env.CHAIN_ID || 137);
    const builderApiKey = process.env.BUILDER_API_KEY;
    const builderSecret = process.env.BUILDER_SECRET;
    const builderPassphrase = process.env.BUILDER_PASSPHRASE;

    if (!builderApiKey || !builderSecret || !builderPassphrase) {
      logger.error('CopyEngine blocked: missing builder credentials');
      return;
    }

    const builderConfig = BuilderConfig
      ? new BuilderConfig({
          localBuilderCreds: {
            key: builderApiKey,
            secret: builderSecret,
            passphrase: builderPassphrase,
          },
        })
      : undefined;

    for (const copier of copiers) {
      try {
        const usdc = copier.fixedUsdc;
        if (usdc <= 0) continue;
        const price = Number(trade.price);
        if (!Number.isFinite(price) || price <= 0 || price >= 1) {
          logger.warn('Copy skipped: invalid source price', { copierId: copier.id, price });
          continue;
        }

        const sizeShares = usdc / price;

        const creds = {
          key: copier.apiKey,
          secret: copier.apiSecret,
          passphrase: copier.apiPassphrase,
        };

        // 1A model: use encrypted-at-rest delegated L2 key generated at onboarding
        const signer = new Wallet(copier.l2PrivateKey);

        const client = new ClobClient(
          host,
          chainId,
          signer,
          creds,
          1,
          copier.copierAddress,
          undefined,
          false,
          builderConfig
        );

        const result = await client.createAndPostOrder(
          {
            tokenID: trade.marketId,
            price,
            size: Number(sizeShares.toFixed(4)),
            side: trade.side === 'BUY' ? Side.BUY : Side.SELL,
          },
          {
            tickSize: '0.01',
            negRisk: false,
          }
        );

        const orderID = (result as any)?.orderID || (result as any)?.id || (result as any)?.order?.orderID;
        if (!orderID) {
          throw new Error(`copy order missing orderID: ${JSON.stringify(result)}`);
        }

        logger.info('✅ Delegated copy-trade executed', {
          copierId: copier.id,
          copierAddress: copier.copierAddress,
          copiedAgentId: trade.agentId,
          fixedUsdc: usdc,
          marketId: trade.marketId,
          side: trade.side,
          price,
          sizeShares: Number(sizeShares.toFixed(4)),
          orderID,
          attributed: true,
        });
      } catch (err) {
        logger.error('❌ Delegated copy-trade failed', {
          copierId: copier.id,
          copierAddress: copier.copierAddress,
          error: (err as Error).message,
        });
      }
    }
  }

  processAsync(trade: SourceTradeEvent): void {
    setImmediate(() => {
      this.process(trade).catch((err) => {
        logger.error('CopyEngine async processing error', {
          error: (err as Error).message,
          agentId: trade.agentId,
        });
      });
    });
  }
}

export const copyEngine = new CopyEngine();
