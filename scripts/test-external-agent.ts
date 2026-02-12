#!/usr/bin/env npx ts-node
/**
 * Integration Test: External Agent Workflow
 *
 * Tests the full external agent lifecycle against a running Cogent server:
 * 1. Agent registration
 * 2. Market data retrieval
 * 3. Order placement & listing
 * 4. Portfolio tracking
 * 5. Leaderboard
 */

const BASE_URL = process.env.COGENT_URL ?? 'http://localhost:3000';

// ─── Minimal inline client (no imports from agents/) ─────────────────────────

async function api(method: string, path: string, body?: any, apiKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as any;
  return { status: res.status, data: json };
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🧪 External Agent Integration Tests');
  console.log(`  Server: ${BASE_URL}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Check server is up
  try {
    const health = await api('GET', '/health');
    assert(health.status === 200, 'Server is running', `status=${health.status}`);
  } catch (err: any) {
    console.log(`\n❌ Server not reachable at ${BASE_URL}`);
    console.log('   Start Cogent first: cd cogent && npm run dev\n');
    process.exit(1);
  }

  // ─── 1. Registration ──────────────────────────────────────────

  console.log('\n📝 1. Agent Registration');

  const ts = Date.now().toString(36);
  const reg = await api('POST', '/api/agents', {
    name: `Test Agent ${ts}`,
    description: 'Integration test agent',
    strategy: 'test',
    deposit: 5000,
  });
  assert(reg.status === 201, 'Registration returns 201');
  assert(!!reg.data.apiKey, 'API key returned');
  assert(!!reg.data.id, `Agent ID assigned: ${reg.data.id}`);
  assert(reg.data.status === 'active', 'Status is active');

  const apiKey = reg.data.apiKey as string;
  const agentId = reg.data.id as string;

  // Duplicate registration should fail
  const dup = await api('POST', '/api/agents', { name: `Test Agent ${ts}` });
  assert(dup.status === 409, 'Duplicate name rejected (409)');

  // ─── 2. Market Data ───────────────────────────────────────────

  console.log('\n📊 2. Market Data');

  const markets = await api('GET', '/api/markets?limit=5');
  assert(markets.status === 200, 'GET /api/markets returns 200');
  assert(Array.isArray(markets.data.markets), 'Markets is an array');

  const marketCount = markets.data.markets.length;
  console.log(`     (${marketCount} markets available)`);

  if (marketCount > 0) {
    const m = markets.data.markets[0];
    assert(!!m.id, `First market has id: ${m.id}`);
    assert(!!m.question, `First market has question`);

    const detail = await api('GET', `/api/markets/${m.id}`);
    assert(detail.status === 200, 'GET /api/markets/:id returns 200');

    // Orderbook endpoint
    const book = await api('GET', `/api/markets/${m.id}/book`);
    // May be 404 if no orderbook data — that's ok
    assert(book.status === 200 || book.status === 404, `GET /api/markets/:id/book returns ${book.status}`);
  }

  // ─── 3. Orders ────────────────────────────────────────────────

  console.log('\n📋 3. Orders');

  // Place order (needs a market ID — use first market or a fake one)
  const testMarketId = marketCount > 0 ? markets.data.markets[0].id : 'test-market-001';
  const yesPrice = marketCount > 0
    ? Number(markets.data.markets[0].outcomePrices?.[0] ?? 0.5)
    : 0.55;

  const order = await api('POST', '/api/orders', {
    marketId: testMarketId,
    side: 'BUY',
    outcome: 'YES',
    amount: 100,
    price: Math.min(yesPrice, 0.95),
    type: 'LIMIT',
  }, apiKey);
  assert(order.status === 201 || order.status === 502, `POST /api/orders returns ${order.status}`);

  if (order.status === 201) {
    assert(!!order.data.orderId, `Order ID: ${order.data.orderId}`);

    // List orders
    const orders = await api('GET', '/api/orders', undefined, apiKey);
    assert(orders.status === 200, 'GET /api/orders returns 200');
    assert(orders.data.orders.length > 0, `Has ${orders.data.orders.length} order(s)`);
  }

  // Unauthenticated request should fail
  const noAuth = await api('GET', '/api/orders');
  assert(noAuth.status === 401, 'Orders without API key returns 401');

  // ─── 4. Portfolio ─────────────────────────────────────────────

  console.log('\n💰 4. Portfolio');

  const portfolio = await api('GET', '/api/portfolio', undefined, apiKey);
  assert(portfolio.status === 200, 'GET /api/portfolio returns 200');
  assert(portfolio.data.agentId === agentId, 'Portfolio matches agent');
  assert(typeof portfolio.data.totalEquity === 'number', `Equity: $${portfolio.data.totalEquity}`);

  const history = await api('GET', '/api/portfolio/history', undefined, apiKey);
  assert(history.status === 200, 'GET /api/portfolio/history returns 200');

  // ─── 5. Leaderboard ──────────────────────────────────────────

  console.log('\n🏆 5. Leaderboard');

  const lb = await api('GET', '/api/leaderboard');
  assert(lb.status === 200, 'GET /api/leaderboard returns 200');
  assert(Array.isArray(lb.data.leaderboard), 'Leaderboard is an array');

  // Our agent should be on it
  const ourEntry = lb.data.leaderboard.find((e: any) => e.agentId === agentId);
  assert(!!ourEntry, 'Our agent appears on leaderboard');

  // ─── 6. Connected Agents ─────────────────────────────────────

  console.log('\n🔌 6. Connected Agents');

  const connected = await api('GET', '/api/connected-agents');
  assert(connected.status === 200, 'GET /api/connected-agents returns 200');
  const ourAgent = connected.data.agents.find((a: any) => a.id === agentId);
  assert(!!ourAgent, 'Our agent listed as connected');
  assert(ourAgent?.strategy === 'test', 'Strategy preserved');

  // ─── Results ──────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
