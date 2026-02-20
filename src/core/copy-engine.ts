// SECURITY: Option C — orders must be signed client-side. Backend never holds private keys.
import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { copierStore } from '../models/copier';

export interface SourceTradeEvent {
  agentId: string;
  marketId: string; // tokenId in current relay flow
  side: string;
  outcome: string;
  amount: number;
  price: number;
}

export interface PendingCopyOrder {
  id: string;
  agentId: string;
  copierId: string;
  tokenID: string;
  price: number;
  size: number;
  side: string;
  createdAt: number;
}

const pendingCopies = new Map<string, PendingCopyOrder>();

export function getPendingCopies(agentId: string): PendingCopyOrder[] {
  const result: PendingCopyOrder[] = [];
  for (const order of pendingCopies.values()) {
    if (order.agentId === agentId) {
      result.push(order);
    }
  }
  return result;
}

export function clearPendingCopy(id: string): void {
  pendingCopies.delete(id);
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

        // SECURITY: Option C — orders must be signed client-side. Backend never holds private keys.
        const pending: PendingCopyOrder = {
          id: uuid(),
          agentId: trade.agentId,
          copierId: copier.id,
          tokenID: trade.marketId,
          price,
          size: Number(sizeShares.toFixed(4)),
          side: trade.side,
          createdAt: Date.now(),
        };

        pendingCopies.set(pending.id, pending);

        logger.info('⏳ Copy order queued for client-side signing (Option C)', {
          pendingCopyId: pending.id,
          copierId: copier.id,
          copierAddress: copier.copierAddress,
          copiedAgentId: trade.agentId,
          fixedUsdc: usdc,
          tokenID: trade.marketId,
          side: trade.side,
          price,
          sizeShares: pending.size,
        });
      } catch (err) {
        logger.error('❌ Copy order queuing failed', {
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
