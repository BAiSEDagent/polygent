import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Whale Tracker Strategy
 *
 * Monitors the Polymarket leaderboard for top traders.
 * Detects new large positions (>$1K) and generates copy-trade signals.
 *
 * Data flow:
 * 1. Fetch leaderboard from Data API → get top wallet addresses
 * 2. Poll positions for each whale via /positions?user={wallet}
 * 3. Diff against previous snapshot to detect NEW positions
 * 4. Generate paper trade signals for large new entries
 */

interface WhaleProfile {
  address: string;
  rank: number;
  profit: number;
  volume: number;
  winRate: number;
  markets: number;
}

interface WhalePosition {
  marketId: string;
  outcome: 'YES' | 'NO';
  size: number;
  avgPrice: number;
  currentValue: number;
}

interface PositionSnapshot {
  positions: Map<string, WhalePosition>;
  timestamp: number;
}

export class WhaleTrackerStrategy extends BaseStrategy {
  readonly name = 'whale-tracker';
  readonly description = 'Copy trades from top Polymarket leaderboard wallets';
  readonly version = '1.0.0';

  private whaleProfiles: WhaleProfile[] = [];
  private positionSnapshots = new Map<string, PositionSnapshot>();
  private pendingSignals = new Map<string, Signal>(); // marketId → signal
  private lastLeaderboardRefresh = 0;
  private lastPositionPoll = 0;

  private readonly TOP_WHALE_COUNT = 20;
  private readonly MIN_POSITION_SIZE = 1_000;  // $1K minimum to trigger
  private readonly LEADERBOARD_REFRESH_MS = 300_000; // 5 min
  private readonly POSITION_POLL_MS = 120_000; // 2 min
  private readonly SIZE_SCALE_FACTOR = 0.05; // Copy 5% of whale's size
  private readonly BASE_URL = config.DATA_API_URL;

  async init(): Promise<void> {
    await this.refreshLeaderboard();
    logger.info(`🐋 Whale tracker initialized, tracking ${this.whaleProfiles.length} whales`);
  }

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    const now = Date.now();

    // Periodically refresh leaderboard
    if (now - this.lastLeaderboardRefresh > this.LEADERBOARD_REFRESH_MS) {
      await this.refreshLeaderboard();
    }

    // Periodically poll whale positions
    if (now - this.lastPositionPoll > this.POSITION_POLL_MS) {
      await this.pollWhalePositions();
    }

    // Check if any whale recently entered this market
    const signal = this.pendingSignals.get(market.id);
    if (signal) {
      this.pendingSignals.delete(market.id);

      // Adjust size to agent's portfolio
      const maxSize = context.agent.equity.current * context.agent.config.maxPositionPct;
      const adjustedSize = Math.min(signal.suggestedSize, maxSize);

      if (adjustedSize < 1) return null;

      return {
        ...signal,
        suggestedSize: adjustedSize,
      };
    }

    return null;
  }

  private async refreshLeaderboard(): Promise<void> {
    this.lastLeaderboardRefresh = Date.now();

    try {
      const response = await fetch(
        `${this.BASE_URL}/leaderboard?limit=${this.TOP_WHALE_COUNT}&window=all`
      );
      if (!response.ok) {
        logger.debug(`Leaderboard API returned ${response.status}`);
        return;
      }

      const data = await response.json() as any;
      const entries = Array.isArray(data) ? data : (data.leaderboard ?? data.data ?? []);

      this.whaleProfiles = entries.slice(0, this.TOP_WHALE_COUNT).map((e: any, i: number) => ({
        address: e.address ?? e.wallet ?? e.proxyWallet ?? '',
        rank: i + 1,
        profit: Number(e.profit ?? e.totalProfit ?? e.pnl ?? 0),
        volume: Number(e.volume ?? e.totalVolume ?? 0),
        winRate: Number(e.winRate ?? e.win_rate ?? 0.5),
        markets: Number(e.markets ?? e.marketCount ?? 0),
      })).filter((w: WhaleProfile) => w.address);

      logger.debug(`Leaderboard refreshed: ${this.whaleProfiles.length} whales`);
    } catch (error) {
      logger.debug('Failed to fetch leaderboard', { error: (error as Error).message });
    }
  }

  private async pollWhalePositions(): Promise<void> {
    this.lastPositionPoll = Date.now();

    for (const whale of this.whaleProfiles.slice(0, 10)) { // Top 10 only to avoid rate limits
      try {
        const response = await fetch(
          `${this.BASE_URL}/positions?user=${whale.address}`
        );
        if (!response.ok) continue;

        const data = await response.json() as any;
        const positions = Array.isArray(data) ? data : (data.positions ?? []);

        const currentPositions = new Map<string, WhalePosition>();
        for (const pos of positions) {
          const marketId = pos.market ?? pos.marketId ?? pos.condition_id ?? '';
          const size = Number(pos.size ?? pos.amount ?? pos.value ?? 0);
          if (!marketId || size === 0) continue;

          currentPositions.set(marketId, {
            marketId,
            outcome: (pos.outcome ?? pos.side ?? 'YES').toUpperCase() as 'YES' | 'NO',
            size: Math.abs(size),
            avgPrice: Number(pos.avgPrice ?? pos.price ?? 0.5),
            currentValue: Number(pos.currentValue ?? pos.value ?? size),
          });
        }

        // Compare with previous snapshot to find NEW positions
        const prevSnapshot = this.positionSnapshots.get(whale.address);

        if (prevSnapshot) {
          for (const [marketId, pos] of currentPositions) {
            const prevPos = prevSnapshot.positions.get(marketId);

            // Detect new or significantly increased positions
            const isNew = !prevPos;
            const isIncreased = prevPos && pos.size > prevPos.size * 1.5;

            if ((isNew || isIncreased) && pos.currentValue >= this.MIN_POSITION_SIZE) {
              const confidence = this.calculateWhaleConfidence(whale);

              const signal = this.createSignal(marketId, {
                direction: 'BUY',
                outcome: pos.outcome,
                confidence,
                suggestedPrice: pos.avgPrice,
                suggestedSize: pos.currentValue * this.SIZE_SCALE_FACTOR,
                reasoning: `🐋 Whale #${whale.rank} (${whale.address.slice(0, 8)}...) ${isNew ? 'entered' : 'increased'} ${pos.outcome} position worth $${pos.currentValue.toFixed(0)}. Whale win rate: ${(whale.winRate * 100).toFixed(0)}%, profit: $${whale.profit.toFixed(0)}`,
              });

              this.pendingSignals.set(marketId, signal);
            }
          }
        }

        // Update snapshot
        this.positionSnapshots.set(whale.address, {
          positions: currentPositions,
          timestamp: Date.now(),
        });

        // Small delay between whale lookups to avoid rate limits
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        logger.debug(`Failed to poll positions for whale ${whale.address.slice(0, 8)}`, {
          error: (error as Error).message,
        });
      }
    }
  }

  private calculateWhaleConfidence(whale: WhaleProfile): number {
    let confidence = 0.5;

    if (whale.rank <= 3) confidence += 0.2;
    else if (whale.rank <= 10) confidence += 0.15;
    else confidence += 0.05;

    if (whale.winRate > 0.65) confidence += 0.15;
    else if (whale.winRate > 0.55) confidence += 0.1;

    if (whale.profit > 100_000) confidence += 0.1;
    else if (whale.profit > 10_000) confidence += 0.05;

    return Math.min(confidence, 0.90);
  }
}
