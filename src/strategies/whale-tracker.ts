import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Whale Tracker Strategy
 *
 * Monitors the Polymarket leaderboard for large trades by top wallets.
 * When a whale places a significant position, generates a copy signal
 * with configurable delay and size scaling.
 *
 * Logic:
 * 1. Poll the data API leaderboard for top traders
 * 2. Track their recent activity
 * 3. When a whale enters a new position > threshold, generate a BUY signal
 * 4. Scale position size relative to agent's portfolio (not whale's)
 * 5. Apply confidence based on whale's historical accuracy
 */

interface WhaleActivity {
  walletAddress: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  size: number;
  price: number;
  timestamp: number;
}

interface WhaleProfile {
  address: string;
  rank: number;
  totalProfit: number;
  winRate: number;
  lastSeen: number;
}

export class WhaleTrackerStrategy extends BaseStrategy {
  readonly name = 'whale-tracker';
  readonly description = 'Copy trades from top Polymarket leaderboard wallets';
  readonly version = '1.0.0';

  private whaleProfiles = new Map<string, WhaleProfile>();
  private recentActivity: WhaleActivity[] = [];
  private processedTxs = new Set<string>();

  // Configuration
  private readonly MIN_WHALE_TRADE_SIZE = 500; // $500 minimum to trigger
  private readonly MAX_COPY_DELAY_MS = 60_000; // Max 60s delay before copying
  private readonly SIZE_SCALE_FACTOR = 0.1; // Copy 10% of whale's size
  private readonly MIN_CONFIDENCE = 0.6; // Minimum confidence to generate signal
  private readonly TOP_WHALE_COUNT = 20; // Track top N wallets

  async init(): Promise<void> {
    await this.refreshLeaderboard();
    logger.info(`Whale tracker initialized, tracking ${this.whaleProfiles.size} whales`);
  }

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    // Refresh whale data periodically
    await this.refreshWhaleActivity();

    // Find recent whale activity in this market
    const cutoff = Date.now() - this.MAX_COPY_DELAY_MS;
    const relevantActivity = this.recentActivity.filter(
      (a) => a.marketId === market.id && a.timestamp > cutoff && a.size >= this.MIN_WHALE_TRADE_SIZE
    );

    if (relevantActivity.length === 0) return null;

    // Aggregate whale signals
    let yesBias = 0;
    let noBias = 0;
    let totalSize = 0;
    let maxConfidence = 0;

    for (const activity of relevantActivity) {
      const whale = this.whaleProfiles.get(activity.walletAddress);
      if (!whale) continue;

      const confidence = this.calculateConfidence(whale, activity);
      if (confidence < this.MIN_CONFIDENCE) continue;

      maxConfidence = Math.max(maxConfidence, confidence);
      totalSize += activity.size;

      if (activity.outcome === 'YES') {
        yesBias += activity.size * confidence;
      } else {
        noBias += activity.size * confidence;
      }
    }

    if (maxConfidence < this.MIN_CONFIDENCE) return null;

    // Determine direction based on aggregated whale sentiment
    const outcome = yesBias >= noBias ? 'YES' : 'NO';
    const priceIndex = outcome === 'YES' ? 0 : 1;
    const currentPrice = market.outcomePrices[priceIndex] ?? 0.5;

    // Scale size to agent's portfolio
    const suggestedSize = Math.min(
      totalSize * this.SIZE_SCALE_FACTOR,
      context.agent.equity.current * context.agent.config.maxPositionPct
    );

    if (suggestedSize < 1) return null;

    return this.createSignal(market.id, {
      direction: 'BUY',
      outcome,
      confidence: maxConfidence,
      suggestedPrice: currentPrice,
      suggestedSize,
      reasoning: `${relevantActivity.length} whale(s) entered ${outcome} position totaling $${totalSize.toFixed(0)} in "${market.question}". Top whale win rate: ${((this.getTopWhaleWinRate(relevantActivity)) * 100).toFixed(0)}%`,
    });
  }

  private calculateConfidence(whale: WhaleProfile, activity: WhaleActivity): number {
    let confidence = 0.5;

    // Boost for high-ranked whales
    if (whale.rank <= 5) confidence += 0.2;
    else if (whale.rank <= 10) confidence += 0.15;
    else if (whale.rank <= 20) confidence += 0.1;

    // Boost for profitable whales
    if (whale.winRate > 0.6) confidence += 0.15;
    if (whale.winRate > 0.7) confidence += 0.1;

    // Boost for larger trades (relative to threshold)
    const sizeMultiple = activity.size / this.MIN_WHALE_TRADE_SIZE;
    if (sizeMultiple > 5) confidence += 0.1;
    if (sizeMultiple > 10) confidence += 0.05;

    return Math.min(confidence, 0.95);
  }

  private getTopWhaleWinRate(activities: WhaleActivity[]): number {
    const whales = activities
      .map((a) => this.whaleProfiles.get(a.walletAddress))
      .filter(Boolean) as WhaleProfile[];
    if (whales.length === 0) return 0;
    return whales.reduce((sum, w) => sum + w.winRate, 0) / whales.length;
  }

  private async refreshLeaderboard(): Promise<void> {
    try {
      const response = await fetch(`${config.DATA_API_URL}/leaderboard?limit=${this.TOP_WHALE_COUNT}`);
      if (!response.ok) return;

      const data = (await response.json()) as any[];
      this.whaleProfiles.clear();

      for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        this.whaleProfiles.set(entry.address ?? entry.wallet, {
          address: entry.address ?? entry.wallet,
          rank: i + 1,
          totalProfit: Number(entry.profit ?? entry.totalProfit ?? 0),
          winRate: Number(entry.winRate ?? entry.win_rate ?? 0.5),
          lastSeen: Date.now(),
        });
      }
    } catch (error) {
      logger.debug('Failed to refresh leaderboard', { error: (error as Error).message });
    }
  }

  private async refreshWhaleActivity(): Promise<void> {
    // In production, this would poll the data API for recent trades
    // by tracked whale addresses. For now, this is a placeholder
    // that would be implemented with the actual data API.

    // Clean up old activity (older than 5 minutes)
    const cutoff = Date.now() - 300_000;
    this.recentActivity = this.recentActivity.filter((a) => a.timestamp > cutoff);
  }
}
