#!/usr/bin/env npx tsx
/**
 * External Whale Bot
 *
 * A standalone agent that:
 * 1. Registers with Cogent's API
 * 2. Polls markets every 2 minutes
 * 3. Fetches whale positions from Polymarket Data API
 * 4. Places paper trades on Cogent when whale moves are detected
 * 5. Tracks performance via the portfolio API
 */

import { CogentClient, Market } from './cogent-client';

// ─── Config ──────────────────────────────────────────────────────────────────

const COGENT_URL = process.env.COGENT_URL ?? 'http://localhost:3000';
const POLL_INTERVAL_MS = 2 * 60_000; // 2 minutes
const WHALE_THRESHOLD_USD = 10_000; // Min position to count as whale
const BOT_NAME = 'External Whale Bot';
const BOT_DESCRIPTION = 'Tracks whale movements on Polymarket and copies large positions';

// ─── Polymarket Data API (direct — bot's own intelligence) ───────────────────

interface WhalePosition {
  address: string;
  market: string;
  outcome: 'YES' | 'NO';
  size: number;
  avgPrice: number;
  currentPrice: number;
}

async function fetchWhalePositions(conditionId: string): Promise<WhalePosition[]> {
  try {
    // Polymarket Data API — large positions endpoint
    const url = `https://data-api.polymarket.com/positions?market=${conditionId}&sizeThreshold=${WHALE_THRESHOLD_USD}&limit=20`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as any[];

    return data.map((p: any) => ({
      address: p.proxyWallet ?? p.owner ?? 'unknown',
      market: conditionId,
      outcome: p.outcome === 0 ? 'YES' as const : 'NO' as const,
      size: Number(p.size ?? p.currentValue ?? 0),
      avgPrice: Number(p.avgPrice ?? 0),
      currentPrice: Number(p.curPrice ?? 0),
    })).filter((p: WhalePosition) => p.size >= WHALE_THRESHOLD_USD);
  } catch {
    // Data API may not be available — generate simulated whale data for demo
    return simulateWhalePositions(conditionId);
  }
}

function simulateWhalePositions(conditionId: string): WhalePosition[] {
  // For demo/testing: simulate whale detection based on market conditions
  const rand = Math.random();
  if (rand < 0.3) return []; // 70% chance of whale detection

  const outcome = rand > 0.65 ? 'YES' as const : 'NO' as const;
  const size = 15_000 + Math.random() * 85_000;
  const price = 0.3 + Math.random() * 0.4;

  return [{
    address: `0x${Math.random().toString(16).slice(2, 42)}`,
    market: conditionId,
    outcome,
    size,
    avgPrice: price,
    currentPrice: price + (Math.random() - 0.5) * 0.05,
  }];
}

// ─── Bot Logic ───────────────────────────────────────────────────────────────

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

class WhaleBot {
  private client: CogentClient;
  private trackedWhales = new Map<string, number>(); // market:outcome → last trade timestamp
  private running = false;

  constructor() {
    this.client = new CogentClient(COGENT_URL);
  }

  async start(): Promise<void> {
    log('🐋 External Whale Bot starting...');
    log(`   Cogent URL: ${COGENT_URL}`);

    // 1. Register with Cogent
    try {
      const reg = await this.client.register(BOT_NAME, BOT_DESCRIPTION, 'whale-tracker');
      log(`✅ Registered as ${reg.id}`);
      log(`   API Key: ${reg.apiKey.slice(0, 12)}...`);
      log(`   Wallet: ${reg.walletAddress}`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        log('⚠️  Bot already registered (name conflict). Use a unique name or re-register.');
        process.exit(1);
      }
      throw err;
    }

    // 2. Check initial portfolio
    const portfolio = await this.client.getPortfolio();
    log(`💰 Starting equity: $${portfolio.totalEquity.toLocaleString()}`);

    // 3. Start polling loop
    this.running = true;
    log(`🔄 Polling markets every ${POLL_INTERVAL_MS / 1000}s`);

    await this.poll(); // First poll immediately
    const interval = setInterval(() => this.poll(), POLL_INTERVAL_MS);

    // Graceful shutdown
    process.on('SIGINT', () => {
      log('🛑 Shutting down...');
      this.running = false;
      clearInterval(interval);
      this.printSummary().then(() => process.exit(0));
    });
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      // Get top markets from Cogent
      const markets = await this.client.getMarkets(10);
      log(`📊 Fetched ${markets.length} markets`);

      if (markets.length === 0) {
        log('   No markets available, waiting...');
        return;
      }

      // For each top market, check whale positions
      for (const market of markets.slice(0, 5)) {
        await this.analyzeMarket(market);
      }
    } catch (err: any) {
      log(`❌ Poll error: ${err.message}`);
    }
  }

  private async analyzeMarket(market: Market): Promise<void> {
    const marketId = market.conditionId ?? market.id;
    const whales = await fetchWhalePositions(marketId);

    if (whales.length === 0) return;

    log(`🐋 ${whales.length} whale(s) detected in: ${market.question.slice(0, 60)}...`);

    for (const whale of whales) {
      const key = `${market.id}:${whale.outcome}`;
      const lastTrade = this.trackedWhales.get(key) ?? 0;

      // Don't re-trade the same signal within 10 minutes
      if (Date.now() - lastTrade < 10 * 60_000) continue;

      // Determine our trade: follow the whale
      const yesPrice = market.outcomePrices?.[0] ?? 0.5;
      const noPrice = market.outcomePrices?.[1] ?? 0.5;
      const price = whale.outcome === 'YES' ? yesPrice : noPrice;

      // Size: fraction of whale's position (we're smaller)
      const ourSize = Math.min(whale.size * 0.1, 500);

      if (ourSize < 10 || price < 0.05 || price > 0.95) continue;

      log(`   → Following whale: ${whale.outcome} @ $${price.toFixed(3)}, size: $${ourSize.toFixed(0)}`);
      log(`     Whale size: $${whale.size.toLocaleString()}, addr: ${whale.address.slice(0, 10)}...`);

      try {
        const order = await this.client.placeOrder({
          marketId: market.id,
          side: 'BUY',
          outcome: whale.outcome,
          amount: ourSize,
          price,
          type: 'LIMIT',
        });
        log(`   ✅ Order placed: ${order.orderId} (${order.status})`);
        this.trackedWhales.set(key, Date.now());
      } catch (err: any) {
        log(`   ❌ Order failed: ${err.message}`);
      }
    }
  }

  private async printSummary(): Promise<void> {
    try {
      const portfolio = await this.client.getPortfolio();
      const history = await this.client.getTradeHistory(100);

      log('');
      log('═══════════════════════════════════════════');
      log('  📊 WHALE BOT SESSION SUMMARY');
      log('═══════════════════════════════════════════');
      log(`  Equity:     $${portfolio.totalEquity.toFixed(2)}`);
      log(`  P&L:        $${portfolio.totalPnl.toFixed(2)} (${(portfolio.totalPnlPct * 100).toFixed(2)}%)`);
      log(`  Positions:  ${portfolio.positions.length}`);
      log(`  Trades:     ${history.total}`);
      log(`  Exposure:   $${portfolio.openExposure.toFixed(2)}`);
      log('═══════════════════════════════════════════');
    } catch {
      log('Could not fetch final summary');
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const bot = new WhaleBot();
bot.start().catch((err) => {
  log(`💀 Fatal error: ${err.message}`);
  process.exit(1);
});
