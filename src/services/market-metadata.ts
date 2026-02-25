import { logger } from '../utils/logger';
import { getDb } from '../core/db';

/**
 * Market Metadata Cache Service
 * 
 * Fetches and caches Polymarket market metadata required for CTF redemption.
 * This enables programmatic position closing without relying on CLOB SELL orders.
 */

export interface MarketMetadata {
  tokenId: string;
  conditionId: string;
  questionId: string;
  parentCollectionId: string;
  indexSet: number;
  question: string;
  outcomes: string[];
  fetched: number;
}

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Initialize market_metadata table
 */
export function initMarketMetadataTable(): void {
  const db = getDb();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_metadata (
      token_id TEXT PRIMARY KEY,
      condition_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      parent_collection_id TEXT NOT NULL,
      index_set INTEGER NOT NULL,
      question TEXT,
      outcomes TEXT,
      fetched_at INTEGER NOT NULL
    )
  `);

  logger.info('Market metadata cache initialized');
}

/**
 * Fetch market metadata from Polymarket Gamma API by token ID
 */
async function fetchMarketMetadata(tokenId: string): Promise<MarketMetadata | null> {
  try {
    // Query Gamma API for market by token ID
    const response = await fetch(`${GAMMA_API}/markets?active=true&closed=false&limit=1000`);
    
    if (!response.ok) {
      throw new Error(`Gamma API error: ${response.status}`);
    }

    const markets = await response.json() as any[];

    // Find market containing this token
    for (const market of markets) {
      if (!market.tokens || market.tokens.length === 0) continue;

      for (let i = 0; i < market.tokens.length; i++) {
        const token = market.tokens[i];
        if (token.token_id === tokenId) {
          return {
            tokenId: tokenId,
            conditionId: market.condition_id,
            questionId: market.question_id,
            parentCollectionId: '0x0000000000000000000000000000000000000000000000000000000000000000', // USDC.e has no parent
            indexSet: i + 1, // YES=1, NO=2 (1-indexed)
            question: market.question,
            outcomes: market.outcomes || ['YES', 'NO'],
            fetched: Date.now()
          };
        }
      }
    }

    logger.warn('Token ID not found in active markets', { tokenId });
    return null;
  } catch (err) {
    logger.error('Failed to fetch market metadata', { tokenId, error: err });
    return null;
  }
}

/**
 * Get market metadata (from cache or fetch fresh)
 */
export async function getMarketMetadata(tokenId: string): Promise<MarketMetadata | null> {
  const db = getDb();

  // Check cache first
  const cached = db.prepare(`
    SELECT * FROM market_metadata WHERE token_id = ? AND fetched_at > ?
  `).get(tokenId, Date.now() - CACHE_TTL_MS) as any;

  if (cached) {
    logger.debug('Market metadata cache hit', { tokenId });
    return {
      tokenId: cached.token_id,
      conditionId: cached.condition_id,
      questionId: cached.question_id,
      parentCollectionId: cached.parent_collection_id,
      indexSet: cached.index_set,
      question: cached.question,
      outcomes: JSON.parse(cached.outcomes || '[]'),
      fetched: cached.fetched_at
    };
  }

  // Cache miss — fetch fresh
  logger.debug('Market metadata cache miss, fetching...', { tokenId });
  const metadata = await fetchMarketMetadata(tokenId);

  if (!metadata) {
    return null;
  }

  // Store in cache
  db.prepare(`
    INSERT OR REPLACE INTO market_metadata 
    (token_id, condition_id, question_id, parent_collection_id, index_set, question, outcomes, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    metadata.tokenId,
    metadata.conditionId,
    metadata.questionId,
    metadata.parentCollectionId,
    metadata.indexSet,
    metadata.question,
    JSON.stringify(metadata.outcomes),
    metadata.fetched
  );

  logger.info('Market metadata cached', { tokenId, conditionId: metadata.conditionId });
  return metadata;
}

/**
 * Prefetch metadata for multiple tokens (batch optimization)
 */
export async function prefetchMarketMetadata(tokenIds: string[]): Promise<void> {
  logger.info('Prefetching market metadata', { count: tokenIds.length });

  for (const tokenId of tokenIds) {
    await getMarketMetadata(tokenId);
    // Rate limit: 1 request per second to avoid API throttling
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info('Market metadata prefetch complete', { count: tokenIds.length });
}

/**
 * Clear stale cache entries (older than TTL)
 */
export function clearStaleMetadata(): number {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM market_metadata WHERE fetched_at < ?
  `).run(Date.now() - CACHE_TTL_MS);

  if (result.changes > 0) {
    logger.info('Cleared stale market metadata', { count: result.changes });
  }

  return result.changes;
}
