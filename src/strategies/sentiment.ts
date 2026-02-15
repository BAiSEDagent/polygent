import { BaseStrategy } from './base';
import { Market, Signal, StrategyContext } from '../utils/types';
import { logger } from '../utils/logger';

/**
 * Sentiment Strategy
 *
 * Analyzes news and social media sentiment for market-relevant events.
 * When strong sentiment diverges from current market prices, generates signals.
 *
 * Current state: Interface-ready stub awaiting news API integration.
 *
 * Planned integrations:
 * - NewsAPI / GNews for headlines
 * - Twitter/X API for social sentiment
 * - LLM-based relevance scoring (Claude/GPT)
 * - Reddit/Polymarket community discussion analysis
 *
 * Architecture:
 * 1. SentimentSource interface — pluggable data sources
 * 2. SentimentAnalyzer — scores sentiment per market
 * 3. Signal generation when sentiment diverges from price
 */

export interface SentimentSource {
  /** Unique source identifier */
  readonly name: string;

  /** Fetch sentiment data for a market question */
  analyze(question: string): Promise<SentimentResult | null>;
}

export interface SentimentResult {
  source: string;
  score: number;       // -1.0 (very bearish) to +1.0 (very bullish)
  confidence: number;  // 0-1 confidence in the sentiment reading
  articles: number;    // Number of data points analyzed
  keywords: string[];  // Key terms driving sentiment
  timestamp: number;
}

export interface SentimentConfig {
  sources: SentimentSource[];
  minArticles: number;          // Minimum data points to generate signal
  minDivergence: number;        // Minimum price-sentiment divergence
  sentimentWeight: number;      // How much to weight sentiment vs current price
}

const DEFAULT_CONFIG: SentimentConfig = {
  sources: [],
  minArticles: 3,
  minDivergence: 0.15,
  sentimentWeight: 0.3,
};

export class SentimentStrategy extends BaseStrategy {
  readonly name = 'sentiment';
  readonly description = 'Trade on news and social media sentiment signals';
  readonly version = '0.2.0';

  private config: SentimentConfig;
  private sentimentCache = new Map<string, { result: SentimentResult; expiresAt: number }>();
  private readonly CACHE_TTL = 300_000; // 5 min

  constructor(config?: Partial<SentimentConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register a sentiment data source */
  addSource(source: SentimentSource): void {
    this.config.sources.push(source);
    logger.info(`Sentiment source registered: ${source.name}`);
  }

  async analyze(market: Market, context: StrategyContext): Promise<Signal | null> {
    // No sources configured → no signals
    if (this.config.sources.length === 0) return null;

    const yesPrice = market.outcomePrices[0] ?? 0.5;

    // Aggregate sentiment from all sources
    const sentimentResults = await this.aggregateSentiment(market.question);
    if (sentimentResults.length === 0) return null;

    // Calculate weighted sentiment score
    const totalWeight = sentimentResults.reduce((s, r) => s + r.confidence * r.articles, 0);
    if (totalWeight === 0) return null;

    const weightedScore = sentimentResults.reduce(
      (s, r) => s + r.score * r.confidence * r.articles,
      0
    ) / totalWeight;

    const totalArticles = sentimentResults.reduce((s, r) => s + r.articles, 0);
    if (totalArticles < this.config.minArticles) return null;

    // Convert sentiment score (-1 to +1) to implied price (0 to 1)
    const impliedPrice = (weightedScore + 1) / 2;
    const divergence = impliedPrice - yesPrice;

    // Only trade on significant divergence
    if (Math.abs(divergence) < this.config.minDivergence) return null;

    const outcome = divergence > 0 ? 'YES' as const : 'NO' as const;
    const suggestedPrice = outcome === 'YES' ? yesPrice : 1 - yesPrice;
    const confidence = Math.min(0.80, 0.5 + Math.abs(divergence));

    const size = this.kellySize(
      suggestedPrice + Math.abs(divergence) * this.config.sentimentWeight,
      1 / suggestedPrice,
      context.agent.equity.current,
      0.15
    );

    if (size < 1) return null;

    const sourceNames = sentimentResults.map(r => r.source).join(', ');

    return this.createSignal(market.id, {
      tokenId: market.tokenIds?.[0],
      negRisk: market.negRisk,
      direction: 'BUY',
      outcome,
      confidence,
      suggestedPrice,
      suggestedSize: size,
      reasoning: `📰 Sentiment: ${totalArticles} data points from [${sourceNames}] suggest ${outcome} for "${market.question.slice(0, 50)}". Sentiment score: ${(weightedScore * 100).toFixed(0)}%, market price: $${yesPrice.toFixed(4)}, divergence: ${(divergence * 100).toFixed(1)}%.`,
    });
  }

  private async aggregateSentiment(question: string): Promise<SentimentResult[]> {
    // Check cache
    const cached = this.sentimentCache.get(question);
    if (cached && Date.now() < cached.expiresAt) {
      return [cached.result];
    }

    const results: SentimentResult[] = [];

    for (const source of this.config.sources) {
      try {
        const result = await source.analyze(question);
        if (result) {
          results.push(result);
          this.sentimentCache.set(question, {
            result,
            expiresAt: Date.now() + this.CACHE_TTL,
          });
        }
      } catch (error) {
        logger.debug(`Sentiment source ${source.name} failed`, {
          error: (error as Error).message,
        });
      }
    }

    return results;
  }
}
