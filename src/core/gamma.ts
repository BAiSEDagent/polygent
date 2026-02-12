import { config } from '../config';
import { logger } from '../utils/logger';
import { Market } from '../utils/types';

/**
 * Gamma API client — fetches market data from Polymarket's Gamma API.
 * Includes an in-memory cache with configurable TTL.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class GammaClient {
  private baseUrl: string;
  private cache = new Map<string, CacheEntry<any>>();
  private ttl: number;

  constructor() {
    this.baseUrl = config.GAMMA_API_URL;
    this.ttl = config.GAMMA_CACHE_TTL;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttl });
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const cacheKey = url.toString();
    const cached = this.getCached<T>(cacheKey);
    if (cached) {
      logger.debug(`Gamma cache hit: ${path}`);
      return cached;
    }

    logger.debug(`Gamma API request: ${url}`);
    const response = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as T;
    this.setCache(cacheKey, data);
    return data;
  }

  /** Normalize raw Gamma API response to our Market type */
  private normalizeMarket(raw: any): Market {
    return {
      id: raw.id ?? raw.condition_id ?? '',
      conditionId: raw.condition_id ?? raw.conditionId ?? '',
      questionId: raw.question_id ?? raw.questionId ?? '',
      question: raw.question ?? '',
      description: raw.description ?? '',
      outcomes: this.parseStringArray(raw.outcomes) ?? ['Yes', 'No'],
      outcomePrices: this.parsePrices(raw.outcomePrices ?? raw.outcome_prices),
      volume: Number(raw.volume ?? raw.volumeNum ?? 0),
      liquidity: Number(raw.liquidity ?? raw.liquidityNum ?? 0),
      endDate: raw.end_date_iso ?? raw.endDate ?? '',
      active: raw.active ?? !raw.closed,
      closed: raw.closed ?? false,
      category: raw.category ?? '',
      tags: raw.tags ?? [],
    };
  }

  /** List active markets */
  async listMarkets(params?: {
    limit?: number;
    offset?: number;
    order?: string;
    ascending?: boolean;
    tag?: string;
  }): Promise<Market[]> {
    const queryParams: Record<string, string> = {
      closed: 'false',
      active: 'true',
      limit: String(params?.limit ?? 20),
      offset: String(params?.offset ?? 0),
    };

    if (params?.order) queryParams.order = params.order;
    if (params?.ascending !== undefined) queryParams.ascending = String(params.ascending);
    if (params?.tag) queryParams.tag = params.tag;

    const raw = await this.request<any[]>('/markets', queryParams);
    return raw.map((m) => this.normalizeMarket(m));
  }

  /** Get a single market by ID */
  async getMarket(marketId: string): Promise<Market | null> {
    try {
      const raw = await this.request<any>(`/markets/${marketId}`);
      return this.normalizeMarket(raw);
    } catch (error) {
      logger.warn(`Market not found: ${marketId}`, { error: (error as Error).message });
      return null;
    }
  }

  /** Search markets by query string */
  async searchMarkets(query: string, limit = 20): Promise<Market[]> {
    const raw = await this.request<any[]>('/markets', {
      closed: 'false',
      limit: String(limit),
      // Gamma API uses text search on question field
      // This is a basic implementation — enhance with full-text search
    });

    const q = query.toLowerCase();
    return raw
      .map((m) => this.normalizeMarket(m))
      .filter(
        (m) =>
          m.question.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      );
  }

  /** Get top markets by volume */
  async getTopMarkets(limit = 10): Promise<Market[]> {
    return this.listMarkets({ limit, order: 'volume', ascending: false });
  }

  /** Parse a string-or-array field (Gamma returns JSON strings for arrays) */
  private parseStringArray(raw: unknown): string[] | null {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string') {
      try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(String) : null; } catch { return null; }
    }
    return null;
  }

  /** Parse outcomePrices which may be a JSON string, array of strings, or array of numbers */
  private parsePrices(raw: unknown): number[] {
    if (!raw) return [];
    let arr: unknown[];
    if (typeof raw === 'string') {
      try { arr = JSON.parse(raw); } catch { return []; }
    } else if (Array.isArray(raw)) {
      arr = raw;
    } else {
      return [];
    }
    return arr.map(Number).filter(n => !isNaN(n));
  }

  /** Clear the cache */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Gamma cache cleared');
  }

  /** Get cache stats */
  cacheStats(): { size: number; keys: string[] } {
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}

export const gammaClient = new GammaClient();
