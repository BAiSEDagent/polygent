/**
 * Auto-Redeemer Service
 * 
 * Monitors settled markets and automatically redeems positions for agents
 * with autoRedeem=true.
 * 
 * Runs every 5 minutes, checks for:
 * 1. Markets that have settled (closed + resolved)
 * 2. Agents with positions in those markets
 * 3. Auto-redeem enabled for those agents
 * 4. Executes redemption via CTF contract
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { getDb } from '../core/db';

class AutoRedeemerService extends EventEmitter {
  private running = false;
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /** Start the auto-redeemer service */
  start(): void {
    if (this.running) return;
    this.running = true;

    logger.info('🔄 Auto-Redeemer service starting');
    
    // Run initial check
    this.checkAndRedeem().catch(err => 
      logger.error('Auto-redeemer initial check failed', { error: err.message })
    );

    // Schedule periodic checks
    this.interval = setInterval(() => {
      this.checkAndRedeem().catch(err =>
        logger.error('Auto-redeemer check failed', { error: err.message })
      );
    }, this.CHECK_INTERVAL_MS);

    logger.info(`Auto-Redeemer running (check interval: ${this.CHECK_INTERVAL_MS / 1000}s)`);
  }

  /** Stop the service */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    logger.info('Auto-Redeemer service stopped');
  }

  /**
   * Main check-and-redeem loop.
   * 
   * TODO: Implement actual redemption logic:
   * 1. Query markets that have settled (use market metadata service)
   * 2. Find agents with positions in those markets + autoRedeem=true
   * 3. For each eligible redemption:
   *    - Call CTF.redeemPositions() or equivalent
   *    - Log success/failure
   *    - Emit events for monitoring
   */
  private async checkAndRedeem(): Promise<void> {
    try {
      const db = getDb();
      
      // Get agents with auto-redeem enabled
      const agentsWithAutoRedeem = db
        .prepare('SELECT id, wallet_address FROM agents WHERE auto_redeem = 1 AND status = ?')
        .all('active') as Array<{ id: string; wallet_address: string }>;

      if (agentsWithAutoRedeem.length === 0) {
        logger.debug('Auto-Redeemer: no agents with auto_redeem enabled');
        return;
      }

      logger.debug(`Auto-Redeemer: checking ${agentsWithAutoRedeem.length} agents`);

      // TODO: Implement settlement detection + redemption
      // For now, just log that we're checking
      for (const agent of agentsWithAutoRedeem) {
        logger.debug(`Checking settled positions for agent ${agent.id}`);
        // 1. Get agent's positions (from portfolio or trades)
        // 2. Check if markets are settled (query Gamma API or local cache)
        // 3. If settled, execute CTF redemption
        // 4. Update position state
      }
    } catch (error) {
      logger.error('Auto-Redeemer error', { error: (error as Error).message });
      throw error;
    }
  }
}

// Singleton
export const autoRedeemerService = new AutoRedeemerService();
