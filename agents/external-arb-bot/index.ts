#!/usr/bin/env npx tsx
/**
 * External Arbitrage Bot
 *
 * Scans Cogent markets for arbitrage opportunities where YES + NO prices
 * don't sum to ~1.0, indicating a mispricing that can be exploited.
 *
 * Strategy: When YES + NO < 0.98, buy both sides for a guaranteed profit.
 */

import { CogentClient, Market } from './cogent-client';

const COGENT_URL = process.env.COGENT_URL ?? 'http://localhost:3000';
const POLL_INTERVAL_MS = 90_000; // 90 seconds
const ARB_THRESHOLD = 0.98; // YES + NO must be below this
const MAX_ORDER_SIZE = 200;

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

class ArbBot {
  private client: CogentClient;
  private exploited = new Set<string>(); // marketIds already arbed

  constructor() {
    this.client = new CogentClient(COGENT_URL);
  }

  async start(): Promise<void> {
    log('📐 External Arb Bot starting...');
    log(`   Cogent URL: ${COGENT_URL}`);
    log(`   Arb threshold: YES+NO < ${ARB_THRESHOLD}`);

    // Register
    const ts = Date.now().toString(36).slice(-4);
    const reg = await this.client.register(
      `Arb Scanner ${ts}`,
      'Finds and exploits YES+NO mispricing opportunities',
      'arbitrage'
    );
    log(`✅ Registered as ${reg.id}`);

    const portfolio = await this.client.getPortfolio();
    log(`💰 Starting equity: $${portfolio.totalEquity.toLocaleString()}`);

    // Poll loop
    await this.scan();
    const interval = setInterval(() => this.scan(), POLL_INTERVAL_MS);

    process.on('SIGINT', () => {
      clearInterval(interval);
      this.printSummary().then(() => process.exit(0));
    });
  }

  private async scan(): Promise<void> {
    try {
      const markets = await this.client.getMarkets(20);
      log(`📊 Scanning ${markets.length} markets for arb...`);

      let opportunities = 0;

      for (const market of markets) {
        if (!market.outcomePrices || market.outcomePrices.length < 2) continue;
        if (this.exploited.has(market.id)) continue;

        const yesPrice = Number(market.outcomePrices[0]);
        const noPrice = Number(market.outcomePrices[1]);
        const sum = yesPrice + noPrice;

        if (sum < ARB_THRESHOLD && sum > 0.5) {
          opportunities++;
          const spread = 1 - sum;
          log(`🎯 ARB FOUND: ${market.question.slice(0, 50)}...`);
          log(`   YES=${yesPrice.toFixed(3)} + NO=${noPrice.toFixed(3)} = ${sum.toFixed(3)} (spread: ${(spread * 100).toFixed(1)}%)`);

          // Buy both sides
          const size = Math.min(MAX_ORDER_SIZE, MAX_ORDER_SIZE * spread * 10);
          try {
            const yesOrder = await this.client.placeOrder({
              marketId: market.id,
              side: 'BUY',
              outcome: 'YES',
              amount: size,
              price: yesPrice,
            });
            const noOrder = await this.client.placeOrder({
              marketId: market.id,
              side: 'BUY',
              outcome: 'NO',
              amount: size,
              price: noPrice,
            });
            log(`   ✅ YES order: ${yesOrder.orderId}, NO order: ${noOrder.orderId}`);
            log(`   Expected profit: $${(size * spread).toFixed(2)}`);
            this.exploited.add(market.id);
          } catch (err: any) {
            log(`   ❌ Order failed: ${err.message}`);
          }
        }
      }

      if (opportunities === 0) {
        log('   No arb opportunities found');
      }
    } catch (err: any) {
      log(`❌ Scan error: ${err.message}`);
    }
  }

  private async printSummary(): Promise<void> {
    try {
      const portfolio = await this.client.getPortfolio();
      log('');
      log('═══════════════════════════════════════════');
      log('  📐 ARB BOT SESSION SUMMARY');
      log('═══════════════════════════════════════════');
      log(`  Equity:     $${portfolio.totalEquity.toFixed(2)}`);
      log(`  P&L:        $${portfolio.totalPnl.toFixed(2)}`);
      log(`  Arbs found: ${this.exploited.size}`);
      log('═══════════════════════════════════════════');
    } catch {}
  }
}

const bot = new ArbBot();
bot.start().catch((err) => {
  log(`💀 Fatal: ${err.message}`);
  process.exit(1);
});
