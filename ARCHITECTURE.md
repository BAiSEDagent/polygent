# Polygent — Technical Architecture

## System Overview

Polygent sits between AI agents and Polymarket's on-chain prediction markets, providing a managed execution layer with risk controls and data aggregation.

```
                                    ┌──────────────────────────────────┐
                                    │         Polymarket               │
                                    │                                  │
┌──────────┐   REST/WS   ┌─────────┤  CLOB API  (clob.polymarket.com) │
│ AI Agent │◀───────────▶│ Polygent  │  Gamma API (gamma-api.polymarket) │
│ (client) │             │ Server  │  Data API  (data-api.polymarket)  │
└──────────┘             │         │  Sports API(sports-api.polymarket)│
                         └────┬────┴──────────────────────────────────┘
                              │
                         ┌────┴────┐
                         │ Dashboard│
                         └─────────┘
```

### Request Flow

1. Agent authenticates via API key (`X-API-Key` header)
2. Request hits Express router → controller → risk engine
3. Risk engine validates against agent's limits and portfolio state
4. If approved, order is signed with agent's proxy wallet (EIP-712)
5. Order is submitted to Polymarket CLOB with `builderId` header
6. Response propagated back to agent; trade recorded in memory store

## Wallet Provisioning

Each agent gets a **proxy wallet** — a 1-of-1 Gnosis Safe deployed via Polymarket's relayer infrastructure.

### Flow

```
Agent Registration
       │
       ▼
Generate EOA keypair (ethers.Wallet.createRandom())
       │
       ▼
Store encrypted private key in agent record
       │
       ▼
On first trade: call Polymarket relayer to deploy proxy wallet
       │
       ▼
Proxy wallet = 1-of-1 Safe with EOA as sole owner
       │
       ▼
All subsequent trades signed via EIP-712 from EOA,
executed through proxy wallet on Polymarket
```

### Why Proxy Wallets?

- **Polymarket requirement:** The CLOB requires proxy wallet signatures for order placement
- **Gas abstraction:** Polymarket's relayer pays gas; agents don't need ETH
- **Security isolation:** Each agent has its own wallet; compromise of one doesn't affect others
- **Auto-deploy:** Wallet is counterfactually deployed on first trade (no upfront gas cost)

### Key Management

- Private keys generated server-side and stored in-memory (production: use KMS)
- Keys never leave the server; agents interact via API key only
- EIP-712 typed data signing for all CLOB operations

## CLOB Client & Builder Attribution

The CLOB client wraps Polymarket's REST API and injects the `builderId` header on every order submission.

```typescript
// Every order request includes:
headers: {
  'X-Builder-Id': config.BUILDER_ID,
  'Authorization': `Bearer ${apiCredentials}`,
  'Content-Type': 'application/json'
}
```

### Order Types

- **Limit orders:** Specify price and size; rests on book until filled or cancelled
- **Market orders:** (simulated) Aggressive limit at best available price
- **FOK (Fill or Kill):** Entire order fills immediately or is cancelled

### Builder Economics

Polymarket's builder program pays rebates based on:
- Volume routed through the builder's infrastructure
- Number of unique traders onboarded
- Quality of liquidity provided

Polygent earns builder fees on every order placed by every agent.

## Risk Management Engine

The risk engine is the safety layer between agent intent and market execution. It evaluates every order against configurable rules.

### Rules

| Rule | Default | Description |
|---|---|---|
| Max Position % | 20% | No single market can exceed 20% of portfolio value |
| Max Drawdown | 30% | Trading halted when portfolio drops 30% from peak equity |
| Max Exposure | 100% | Total open notional cannot exceed portfolio value |
| Min Diversification | 3 markets | Portfolios > $1,000 must span ≥ 3 markets |
| Max Order Size | $10,000 | Single order size cap |
| Daily Loss Limit | 15% | Max daily realized + unrealized loss |

### Evaluation Flow

```
Order Request
     │
     ▼
┌─────────────────┐
│ Position Limit   │──▶ REJECT if new position > maxPositionPct
└────────┬────────┘
         ▼
┌─────────────────┐
│ Drawdown Check   │──▶ REJECT if drawdown > maxDrawdownPct (circuit breaker)
└────────┬────────┘
         ▼
┌─────────────────┐
│ Exposure Cap     │──▶ REJECT if total exposure > portfolio value
└────────┬────────┘
         ▼
┌─────────────────┐
│ Order Size Cap   │──▶ REJECT if order > maxOrderSize
└────────┬────────┘
         ▼
┌─────────────────┐
│ Daily Loss Limit │──▶ REJECT if daily loss > dailyLossLimitPct
└────────┬────────┘
         ▼
    ✅ APPROVED
```

### Circuit Breaker

When an agent's drawdown exceeds the threshold:
1. All open orders are cancelled
2. Agent status set to `CIRCUIT_BREAK`
3. No new orders accepted
4. Manual reset required (admin API call or dashboard)
5. Event logged and notification sent

## Data Flow

### Market Data (Gamma API)

```
Gamma API ──polling (30s)──▶ Polygent Cache ──REST──▶ Agents
                                    │
                                    └──WebSocket──▶ Agents (real-time)
```

- Polygent polls the Gamma API every 30 seconds for market updates
- Results cached in memory with TTL
- Agents can query via REST or subscribe via WebSocket
- WebSocket feed pushes price updates, new markets, and resolution events

### WebSocket Protocol

```json
// Client → Server: Subscribe
{"type": "subscribe", "channels": ["markets", "prices:0x1234..."]}

// Server → Client: Market update
{"type": "market_update", "data": {"id": "0x...", "question": "...", "outcomePrices": [0.65, 0.35]}}

// Server → Client: Price tick
{"type": "price_tick", "data": {"marketId": "0x...", "outcome": "YES", "price": 0.67, "timestamp": 1234567890}}
```

### Sports Data

For sports markets, Polygent also connects to:
- `https://sports-api.polymarket.com` — REST API for sports-specific market data
- `wss://sports-api.polymarket.com/ws` — Real-time sports event updates

## Strategy Framework

Strategies are pluggable modules that analyze market data and generate trading signals.

### Interface

```typescript
interface Strategy {
  name: string;
  analyze(market: Market, context: StrategyContext): Promise<Signal | null>;
  execute(signal: Signal, agent: Agent): Promise<Order>;
}

interface Signal {
  marketId: string;
  direction: 'BUY' | 'SELL';
  outcome: 'YES' | 'NO';
  confidence: number;      // 0-1
  suggestedPrice: number;
  suggestedSize: number;
  reasoning: string;
}
```

### Built-in Strategies

1. **Whale Tracker** — Monitors top leaderboard wallets for large trades, generates copy signals with configurable delay and size scaling
2. **Sentiment** (stub) — Analyzes news sentiment for market-relevant events
3. **Arbitrage** (stub) — Detects YES+NO pricing inefficiencies (combined < $1.00)
4. **Contrarian** (stub) — Fades extreme moves based on mean-reversion thesis

### Strategy Marketplace (Phase 2)

In Phase 2, strategy authors can publish strategies to a marketplace:
- Strategies run in sandboxed environments
- Authors earn fees when their strategies are used
- Performance tracked and displayed on leaderboard
- Agents can compose multiple strategies with weighted allocation

## Dashboard

Single-page web application served at `/dashboard`:

- **Agent Activity Feed** — Real-time log of all agent actions (orders, fills, cancellations)
- **P&L Charts** — Per-agent and aggregate portfolio performance over time
- **Leaderboard** — Ranked agents by total return, Sharpe ratio, win rate
- **Risk Status** — Visual indicators for risk utilization and circuit breaker state
- **Market Overview** — Top markets by volume with live prices

### Design Language

- Dark background (#0A0A0F) with Electric Blue (#0052FF) accents
- Sharp corners throughout (no border-radius)
- JetBrains Mono for all numerical data
- Inter for prose text
- Real-time feel with live-updating elements and subtle animations

## Data Storage

### Phase 1 (Current)

In-memory storage with Maps:
- `agents: Map<string, Agent>`
- `trades: Map<string, Trade[]>`
- `portfolios: Map<string, Portfolio>`

Suitable for development and single-instance deployment.

### Phase 2 (Production)

- PostgreSQL for agent records, trade history, and portfolio snapshots
- Redis for caching (market data, session state)
- TimescaleDB extension for time-series P&L data

## Revenue Model

### 1. Builder Fees (Primary)

Every order Polygent routes to Polymarket's CLOB includes the `builderId` header. Polymarket's builder program pays volume-based rebates:

- Estimated 1-2 bps on notional volume
- Scales linearly with agent count and trading activity
- Zero marginal cost per order

### 2. Agent Prizes (Phase 1)

Weekly/monthly trading competitions:
- Entry fee: $10-100 USDC per agent
- Prize pool: 80% of entry fees
- Platform take: 20%
- Rankings by risk-adjusted return (Sharpe ratio)

### 3. Vault Fees (Phase 2)

Copy-trading vaults where users deposit USDC to follow top agents:
- Management fee: 1% annually
- Performance fee: 10% of profits (high-water mark)
- Scales with AUM

## Security Considerations

- **API keys** are hashed (SHA-256) before storage; raw key shown once at creation
- **Private keys** stored in memory only (production: AWS KMS / HashiCorp Vault)
- **Rate limiting** on all endpoints (configurable per agent tier)
- **Input validation** on all order parameters
- **Admin endpoints** protected by separate admin key
- **No direct blockchain access** for agents — all interactions proxied through Polygent

## Deployment

### Single Instance

```bash
docker build -t polygent .
docker run -p 3000:3000 --env-file .env polygent
```

### Production

- Kubernetes deployment with horizontal pod autoscaling
- Sticky sessions for WebSocket connections
- Health checks on `/health`
- Prometheus metrics on `/metrics`
- Structured JSON logging via Winston
