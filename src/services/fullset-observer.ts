/**
 * FullSetArbObserver — OBSERVE-mode scanner for BTC/ETH 5m/15m full-set arbitrage
 *
 * Phase 1: No trades. No risk. Pure data collection.
 *
 * WHAT WE'RE MEASURING:
 * ─────────────────────
 * For each active BTC/ETH 5m/15m market, we fetch the CLOB orderbook for
 * both Up and Down tokens and compute:
 *
 *   raw_cost = best_ask_up + best_ask_down
 *   edge_bps = (1.00 - raw_cost - fee_buffer) * 10000
 *
 * An "opportunity" exists when edge_bps > min_edge_bps.
 * We measure HOW OFTEN and HOW LONG these persist.
 *
 * KEY QUESTION: If p90 opportunity duration > 300ms → edge is executable.
 *               If p90 < 100ms → it's co-location territory. Stop here.
 *
 * FEE REALITY (from Polymarket docs, Jan/Feb 2026):
 * ─────────────────────────────────────────────────
 * 5-min and 15-min crypto markets have taker fees:
 *   fee = C × p × 0.25 × (p × (1-p))²
 *   Max effective rate: 1.56% at p=0.50
 *   At extremes (p=0.05, p=0.95): ~0.02%
 * Makers earn 20% rebate on taker fees, paid daily.
 *
 * We use fee_buffer_bps = 200 (conservative: covers taker fee both legs at midpoint).
 *
 * UNIVERSE DISCOVERY:
 * ───────────────────
 * BTC_5M: slug regex ^btc-updown-5m-\d+$ / question contains "btc" + "5" + "min"
 * ETH_5M: slug regex ^eth-updown-5m-\d+$
 * BTC_15M: slug regex ^btc-updown-15m-\d+$
 * ETH_15M: slug regex ^eth-updown-15m-\d+$
 *
 * Per Polymarket PDF research: outcomes are ["Up","Down"] not ["Yes","No"].
 * tokenIds[0] = Up token, tokenIds[1] = Down token.
 */

import { gammaClient } from '../core/gamma';
import { getDb } from '../core/db';
import { logger } from '../utils/logger';

// Lazy accessor so we don't pull db before migrations run
const db = () => getDb();

// ─── Fee curve ────────────────────────────────────────────────────────────────
/** Polymarket taker fee for 5/15min crypto: C × p × 0.25 × (p(1-p))² */
export function calcTakerFee(price: number, shares: number = 1): number {
  return shares * price * 0.25 * Math.pow(price * (1 - price), 2);
}

/** Net edge in basis points after both taker fees */
export function calcEdgeBps(askUp: number, askDown: number, safetyBufferBps = 50): number {
  const rawCost = askUp + askDown;
  const feeUp = calcTakerFee(askUp);
  const feeDown = calcTakerFee(askDown);
  const totalFees = feeUp + feeDown;
  const safetyBuffer = safetyBufferBps / 10000;
  return (1.0 - rawCost - totalFees - safetyBuffer) * 10000;
}

// ─── CLOB orderbook fetch ─────────────────────────────────────────────────────
interface BookLevel { price: number; size: number; }
interface OrderBook { bids: BookLevel[]; asks: BookLevel[]; }

async function fetchBook(tokenId: string): Promise<OrderBook | null> {
  try {
    const res = await fetch(
      `https://clob.polymarket.com/book?token_id=${tokenId}`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const raw = await res.json() as any;
    const parseLevels = (arr: any[]): BookLevel[] =>
      (arr ?? [])
        .map((l: any) => ({ price: Number(l.price), size: Number(l.size) }))
        .filter(l => !isNaN(l.price) && !isNaN(l.size));

    return {
      bids: parseLevels(raw.bids ?? []).sort((a, b) => b.price - a.price), // desc
      asks: parseLevels(raw.asks ?? []).sort((a, b) => a.price - b.price), // asc
    };
  } catch {
    return null;
  }
}

// ─── Universe filters ─────────────────────────────────────────────────────────
type Universe = 'BTC_5M' | 'BTC_15M' | 'ETH_5M' | 'ETH_15M';

function detectUniverse(question: string, slug?: string): Universe | null {
  const q = question.toLowerCase();
  const s = (slug ?? '').toLowerCase();

  if (/btc-updown-5m-\d+/.test(s) || (q.includes('bitcoin') || q.includes('btc')) && q.includes('5') && (q.includes('min') || q.includes('minute'))) return 'BTC_5M';
  if (/btc-updown-15m-\d+/.test(s) || (q.includes('bitcoin') || q.includes('btc')) && q.includes('15') && (q.includes('min') || q.includes('minute'))) return 'BTC_15M';
  if (/eth-updown-5m-\d+/.test(s) || (q.includes('ethereum') || q.includes('eth')) && q.includes('5') && (q.includes('min') || q.includes('minute'))) return 'ETH_5M';
  if (/eth-updown-15m-\d+/.test(s) || (q.includes('ethereum') || q.includes('eth')) && q.includes('15') && (q.includes('min') || q.includes('minute'))) return 'ETH_15M';
  return null;
}

// ─── Opportunity tracking ─────────────────────────────────────────────────────
interface OpportunityWindow {
  marketId: string;
  universe: Universe;
  startedAt: number;
  maxEdgeBps: number;
}

interface ObserveSnapshot {
  ts: number;
  universe: Universe;
  marketId: string;
  question: string;
  askUp: number;
  askDown: number;
  rawCost: number;
  edgeBps: number;
  depthUpUsd: number;
  depthDownUsd: number;
}

// ─── Stats aggregator ─────────────────────────────────────────────────────────
interface UniverseStats {
  universe: Universe;
  scans: number;
  rawOpportunities: number;       // raw_cost < 1.0
  qualifiedOpportunities: number; // edge_bps > MIN_EDGE after fees+buffer
  avgRawCost: number;
  minRawCost: number;
  edgeBpsValues: number[];        // for percentile calcs
  durationsMsP: number[];         // completed opp durations
  lastScanAt: number;
}

// ─── Main Observer ────────────────────────────────────────────────────────────
class FullSetArbObserver {
  readonly name = 'fullset_arb_observer';
  readonly version = '1.0.0';

  private readonly MIN_EDGE_BPS = 30;      // min net edge after fees to count as "qualified"
  private readonly SAFETY_BUFFER_BPS = 50; // extra buffer in edge calc
  private readonly SCAN_INTERVAL_MS = 20_000; // 20 seconds between scans
  private readonly REPORT_INTERVAL_MS = 30 * 60 * 1000; // 30 min report

  private stats = new Map<Universe, UniverseStats>();
  private openOpps = new Map<string, OpportunityWindow>(); // key = marketId
  private snapshots: ObserveSnapshot[] = [];
  private startedAt = Date.now();
  private scanCount = 0;
  private timer: NodeJS.Timeout | null = null;
  private reportTimer: NodeJS.Timeout | null = null;

  start(): void {
    logger.info(`📡 FullSetArbObserver v${this.version} starting — OBSERVE MODE ONLY, zero trades`);
    this.ensureDbTable();
    this.timer = setInterval(() => this.scan(), this.SCAN_INTERVAL_MS);
    this.reportTimer = setInterval(() => this.logReport(), this.REPORT_INTERVAL_MS);
    // First scan immediately
    this.scan().catch(err => logger.warn('FullSetArb initial scan failed', { err: err.message }));
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.reportTimer) { clearInterval(this.reportTimer); this.reportTimer = null; }
    logger.info('📡 FullSetArbObserver stopped');
  }

  private ensureDbTable(): void {
    try {
      db().exec(`
        CREATE TABLE IF NOT EXISTS pm_observe_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          universe TEXT NOT NULL,
          market_id TEXT NOT NULL,
          question TEXT,
          ask_up REAL NOT NULL,
          ask_down REAL NOT NULL,
          raw_cost REAL NOT NULL,
          edge_bps REAL NOT NULL,
          depth_up_usd REAL DEFAULT 0,
          depth_down_usd REAL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_obs_ts ON pm_observe_snapshots(ts);
        CREATE INDEX IF NOT EXISTS idx_obs_universe ON pm_observe_snapshots(universe);
        CREATE INDEX IF NOT EXISTS idx_obs_market ON pm_observe_snapshots(market_id);
      `);

      db().exec(`
        CREATE TABLE IF NOT EXISTS pm_observe_opportunities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          market_id TEXT NOT NULL,
          universe TEXT NOT NULL,
          question TEXT,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          duration_ms INTEGER,
          max_edge_bps REAL NOT NULL,
          min_raw_cost REAL
        );
        CREATE INDEX IF NOT EXISTS idx_opp_universe ON pm_observe_opportunities(universe);
      `);

      logger.info('FullSetArb observe tables ready');
    } catch (err: any) {
      logger.warn('FullSetArb table init warning', { err: err.message });
    }
  }

  /** Main scan loop — runs every SCAN_INTERVAL_MS */
  private async scan(): Promise<void> {
    this.scanCount++;
    const scanStart = Date.now();

    // 1. Discover active BTC/ETH 5m/15m markets from Gamma
    // Fetch broader market list and filter — Gamma has no direct slug-regex filter
    const markets = await this.discoverUniverseMarkets();
    if (markets.length === 0) {
      logger.debug('FullSetArb: no BTC/ETH 5m/15m markets found in this scan');
      return;
    }

    logger.debug(`FullSetArb scan #${this.scanCount}: ${markets.length} markets in universe`);

    // 2. For each market, fetch CLOB orderbook for both tokens
    const results = await Promise.allSettled(
      markets.map(m => this.scanMarket(m))
    );

    const elapsed = Date.now() - scanStart;
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    logger.debug(`FullSetArb scan done: ${succeeded}/${markets.length} succeeded in ${elapsed}ms`);
  }

  private async discoverUniverseMarkets(): Promise<Array<{
    marketId: string;
    universe: Universe;
    question: string;
    upTokenId: string;
    downTokenId: string;
    endDate: string;
  }>> {
    try {
      // Fetch a broader set of markets and filter
      const allMarkets = await gammaClient.listMarkets({ limit: 100 });

      const result: Array<{
        marketId: string;
        universe: Universe;
        question: string;
        upTokenId: string;
        downTokenId: string;
        endDate: string;
      }> = [];

      for (const m of allMarkets) {
        if (m.closed || !m.active) continue;
        if (!m.tokenIds || m.tokenIds.length < 2) continue;

        const universe = detectUniverse(m.question);
        if (!universe) continue;

        result.push({
          marketId: m.id,
          universe,
          question: m.question,
          upTokenId: m.tokenIds[0],   // Up/Yes token
          downTokenId: m.tokenIds[1], // Down/No token
          endDate: m.endDate,
        });
      }

      return result;
    } catch (err: any) {
      logger.warn('FullSetArb universe discovery failed', { err: err.message });
      return [];
    }
  }

  private async scanMarket(market: {
    marketId: string;
    universe: Universe;
    question: string;
    upTokenId: string;
    downTokenId: string;
    endDate: string;
  }): Promise<void> {
    const now = Date.now();

    // Fetch orderbooks for both tokens in parallel
    const [upBook, downBook] = await Promise.all([
      fetchBook(market.upTokenId),
      fetchBook(market.downTokenId),
    ]);

    if (!upBook || !downBook) return;
    if (upBook.asks.length === 0 || downBook.asks.length === 0) return;

    const askUp = upBook.asks[0].price;
    const askDown = downBook.asks[0].price;
    const rawCost = askUp + askDown;

    // Calculate depth available at $10 and $25 clip sizes
    const depthUpUsd = this.availableDepth(upBook.asks, 0.25);
    const depthDownUsd = this.availableDepth(downBook.asks, 0.25);

    const edgeBps = calcEdgeBps(askUp, askDown, this.SAFETY_BUFFER_BPS);
    const isQualified = edgeBps >= this.MIN_EDGE_BPS;

    // Log to memory
    const snapshot: ObserveSnapshot = {
      ts: now,
      universe: market.universe,
      marketId: market.marketId,
      question: market.question,
      askUp,
      askDown,
      rawCost,
      edgeBps,
      depthUpUsd,
      depthDownUsd,
    };
    this.snapshots.push(snapshot);
    if (this.snapshots.length > 10_000) this.snapshots.shift(); // rolling window

    // Update stats
    this.updateStats(market.universe, rawCost, edgeBps, isQualified);

    // Opportunity window tracking
    const oppKey = market.marketId;
    if (isQualified) {
      if (!this.openOpps.has(oppKey)) {
        this.openOpps.set(oppKey, {
          marketId: market.marketId,
          universe: market.universe,
          startedAt: now,
          maxEdgeBps: edgeBps,
        });
        logger.info(
          `🎯 FullSetArb OPPORTUNITY: ${market.universe} "${market.question.slice(0, 40)}" | ` +
          `askUp=${askUp.toFixed(4)} askDown=${askDown.toFixed(4)} ` +
          `rawCost=${rawCost.toFixed(4)} edge=${edgeBps.toFixed(1)}bps`
        );
      } else {
        const opp = this.openOpps.get(oppKey)!;
        opp.maxEdgeBps = Math.max(opp.maxEdgeBps, edgeBps);
      }
    } else {
      // Close any open opportunity window
      if (this.openOpps.has(oppKey)) {
        const opp = this.openOpps.get(oppKey)!;
        const durationMs = now - opp.startedAt;
        this.openOpps.delete(oppKey);

        const stats = this.stats.get(opp.universe);
        if (stats) stats.durationsMsP.push(durationMs);

        // Persist completed opportunity
        try {
          db().prepare(`
            INSERT INTO pm_observe_opportunities
            (market_id, universe, question, started_at, ended_at, duration_ms, max_edge_bps, min_raw_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            market.marketId, market.universe, market.question.slice(0, 200),
            opp.startedAt, now, durationMs, opp.maxEdgeBps, rawCost
          );
        } catch { /* ignore */ }

        logger.info(
          `📊 FullSetArb opp CLOSED: ${market.universe} duration=${durationMs}ms ` +
          `maxEdge=${opp.maxEdgeBps.toFixed(1)}bps`
        );
      }
    }

    // Persist snapshot to SQLite (only when near-interesting: rawCost < 1.02)
    if (rawCost < 1.02) {
      try {
        db().prepare(`
          INSERT INTO pm_observe_snapshots
          (ts, universe, market_id, question, ask_up, ask_down, raw_cost, edge_bps, depth_up_usd, depth_down_usd)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          now, market.universe, market.marketId, market.question.slice(0, 200),
          askUp, askDown, rawCost, edgeBps, depthUpUsd, depthDownUsd
        );
      } catch { /* ignore */ }
    }
  }

  private availableDepth(asks: BookLevel[], maxPrice: number): number {
    let depth = 0;
    for (const level of asks) {
      if (level.price > maxPrice) break;
      depth += level.price * level.size;
    }
    return depth;
  }

  private updateStats(universe: Universe, rawCost: number, edgeBps: number, qualified: boolean): void {
    if (!this.stats.has(universe)) {
      this.stats.set(universe, {
        universe,
        scans: 0,
        rawOpportunities: 0,
        qualifiedOpportunities: 0,
        avgRawCost: 0,
        minRawCost: 999,
        edgeBpsValues: [],
        durationsMsP: [],
        lastScanAt: 0,
      });
    }
    const s = this.stats.get(universe)!;
    s.scans++;
    s.lastScanAt = Date.now();
    s.avgRawCost = (s.avgRawCost * (s.scans - 1) + rawCost) / s.scans;
    s.minRawCost = Math.min(s.minRawCost, rawCost);
    if (rawCost < 1.0) s.rawOpportunities++;
    if (qualified) {
      s.qualifiedOpportunities++;
      s.edgeBpsValues.push(edgeBps);
    }
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * p / 100);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  logReport(): void {
    const elapsed = (Date.now() - this.startedAt) / 1000 / 60;

    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info(`📊 FULL-SET ARB OBSERVER REPORT — ${elapsed.toFixed(1)} min uptime`);
    logger.info(`   Scan count: ${this.scanCount} | Min edge threshold: ${this.MIN_EDGE_BPS}bps`);
    logger.info('═══════════════════════════════════════════════════════════════');

    if (this.stats.size === 0) {
      logger.info('   No BTC/ETH 5m/15m markets found yet. Check Gamma API market list.');
      return;
    }

    for (const [universe, s] of this.stats) {
      const qualRate = s.scans > 0 ? ((s.qualifiedOpportunities / s.scans) * 100).toFixed(1) : '0';
      const medEdge = this.percentile(s.edgeBpsValues, 50).toFixed(1);
      const p90Edge = this.percentile(s.edgeBpsValues, 90).toFixed(1);
      const medDur = this.percentile(s.durationsMsP, 50).toFixed(0);
      const p90Dur = this.percentile(s.durationsMsP, 90).toFixed(0);
      const oppPerHour = (s.qualifiedOpportunities / (elapsed / 60)).toFixed(1);

      logger.info(`\n  📌 ${universe}`);
      logger.info(`     Scans: ${s.scans} | Avg rawCost: ${s.avgRawCost.toFixed(4)} | Min rawCost: ${s.minRawCost.toFixed(4)}`);
      logger.info(`     Raw opps (rawCost<1.0): ${s.rawOpportunities} | Qualified (edge>${this.MIN_EDGE_BPS}bps): ${s.qualifiedOpportunities}`);
      logger.info(`     Qualified rate: ${qualRate}% | Opp/hr: ${oppPerHour}`);
      logger.info(`     Edge bps — median: ${medEdge} | p90: ${p90Edge}`);
      logger.info(`     Duration ms — median: ${medDur} | p90: ${p90Dur}`);

      // Verdict
      const p90DurNum = this.percentile(s.durationsMsP, 90);
      if (s.qualifiedOpportunities === 0) {
        logger.info(`     🔴 VERDICT: No qualified opportunities. Markets appear efficient.`);
      } else if (p90DurNum > 300) {
        logger.info(`     🟢 VERDICT: p90 duration ${p90DurNum}ms > 300ms threshold. EXECUTABLE. Build execution module.`);
      } else if (p90DurNum > 100) {
        logger.info(`     🟡 VERDICT: p90 duration ${p90DurNum}ms — borderline. Maker-first only.`);
      } else {
        logger.info(`     🔴 VERDICT: p90 duration ${p90DurNum}ms < 100ms. Co-location territory. Adjust strategy.`);
      }
    }

    logger.info('═══════════════════════════════════════════════════════════════');
  }

  /** HTTP-facing report for /api/fullset/report */
  getReport(): object {
    const elapsed = (Date.now() - this.startedAt) / 1000 / 60;
    const universeReports: object[] = [];

    for (const [universe, s] of this.stats) {
      const p50Dur = this.percentile(s.durationsMsP, 50);
      const p90Dur = this.percentile(s.durationsMsP, 90);
      const p99Dur = this.percentile(s.durationsMsP, 99);
      const medEdge = this.percentile(s.edgeBpsValues, 50);
      const p90Edge = this.percentile(s.edgeBpsValues, 90);
      const oppPerHour = elapsed > 0 ? s.qualifiedOpportunities / (elapsed / 60) : 0;

      let verdict = 'NO_DATA';
      if (s.qualifiedOpportunities === 0) verdict = 'RED_NO_OPPS';
      else if (p90Dur > 300) verdict = 'GREEN_EXECUTABLE';
      else if (p90Dur > 100) verdict = 'YELLOW_BORDERLINE';
      else verdict = 'RED_TOO_FAST';

      universeReports.push({
        universe,
        scans: s.scans,
        avg_raw_cost: Number(s.avgRawCost.toFixed(4)),
        min_raw_cost: Number(s.minRawCost.toFixed(4)),
        raw_opportunities: s.rawOpportunities,
        qualified_opportunities: s.qualifiedOpportunities,
        opportunities_per_hour: Number(oppPerHour.toFixed(2)),
        edge_bps: { p50: Number(medEdge.toFixed(1)), p90: Number(p90Edge.toFixed(1)) },
        duration_ms: { p50: Number(p50Dur.toFixed(0)), p90: Number(p90Dur.toFixed(0)), p99: Number(p99Dur.toFixed(0)) },
        open_opportunities: this.openOpps.size,
        verdict,
      });
    }

    return {
      observer: this.name,
      version: this.version,
      uptime_minutes: Number(elapsed.toFixed(1)),
      scan_count: this.scanCount,
      min_edge_threshold_bps: this.MIN_EDGE_BPS,
      safety_buffer_bps: this.SAFETY_BUFFER_BPS,
      universes: universeReports,
      generated_at: new Date().toISOString(),
    };
  }

  /** Pull recent snapshots from DB for a universe */
  getRecentSnapshots(universe?: string, limit = 100): object[] {
    try {
      const stmt = universe
        ? db().prepare('SELECT * FROM pm_observe_snapshots WHERE universe = ? ORDER BY ts DESC LIMIT ?')
        : db().prepare('SELECT * FROM pm_observe_snapshots ORDER BY ts DESC LIMIT ?');
      return universe
        ? stmt.all(universe, limit) as object[]
        : stmt.all(limit) as object[];
    } catch {
      return [];
    }
  }

  /** Pull completed opportunities from DB */
  getCompletedOpps(universe?: string, limit = 50): object[] {
    try {
      const stmt = universe
        ? db().prepare('SELECT * FROM pm_observe_opportunities WHERE universe = ? ORDER BY started_at DESC LIMIT ?')
        : db().prepare('SELECT * FROM pm_observe_opportunities ORDER BY started_at DESC LIMIT ?');
      return universe
        ? stmt.all(universe, limit) as object[]
        : stmt.all(limit) as object[];
    } catch {
      return [];
    }
  }
}

// Singleton
export const fullSetArbObserver = new FullSetArbObserver();
