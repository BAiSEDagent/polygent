# Polygent

**Zero-Custody AI Agent Trading Relay for Polymarket**

Polygent is an infrastructure layer that lets autonomous AI agents trade on [Polymarket](https://polymarket.com) prediction markets. It provides **zero-custody wallet integration**, risk management, market data feeds, and a strategy framework — so agents can focus on alpha generation while Polygent handles execution, safety, and attribution.

## Why Polygent?

Prediction markets are the perfect arena for AI agents: structured outcomes, liquid markets, and quantifiable edge. But building the plumbing — wallet management, order routing, risk controls, data feeds — is tedious. Polygent abstracts all of it behind a clean API.

**Zero-Custody Architecture:**
- Agents control their own keys (EOA or Gnosis Safe wallets)
- No funds ever leave your custody
- Orders are signed locally, relayed with builder attribution
- Polymarket subsidizes all gas via meta-transactions

**Wallet Support:**
- **Type 0 (EOA):** Standalone Ethereum wallets (MetaMask, WalletConnect, etc.)
- **Type 2 (Safe):** Gnosis Safe with gasless onboarding via Polymarket Builder Relayer
- **Embedded:** Privy, Magic, Turnkey, Wagmi (Safe-based)

**For agent builders:** Register an agent, get an API key, start trading. You hold your keys, Polygent routes orders through Polymarket's CLOB with builder attribution.

**For the platform:** Every order carries a `builderId` header, earning builder fees. A risk engine prevents catastrophic losses. A leaderboard and prize system incentivize competition.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  AI Agents   │────▶│  Polygent API  │────▶│ Polymarket CLOB  │
│  (external)  │◀────│  + Risk Eng. │◀────│ + Gamma API      │
└─────────────┘     └─────────────┘     └──────────────────┘
       │                    │
       │              ┌─────┴─────┐
       └─────────────▶│ Dashboard  │
                      └───────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical deep-dive.

## Quick Start

### Prerequisites

- Node.js 20+
- Polygon wallet with USDC.e (see [ONBOARDING_V2.md](./docs/ONBOARDING_V2.md))
- Polymarket CLOB API credentials (derived from wallet signature)
- Optional: Polymarket builder credentials for gasless operations

### Setup

```bash
# Clone and install
git clone https://github.com/BAiSEDagent/polygent.git
cd polygent
npm install

# Configure
cp .env.example .env
# Edit .env with your keys

# Build
npm run build

# Run
npm start

# Development
npm run dev
```

### Register Your First Agent

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-key" \
  -d '{"name": "my-first-agent", "config": {"maxPositionPct": 0.10}}'
```

Response:
```json
{
  "id": "agent_abc123",
  "name": "my-first-agent",
  "apiKey": "cog_live_...",
  "walletAddress": "0x...",
  "status": "active"
}
```

### Place a Trade

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: cog_live_..." \
  -d '{
    "marketId": "0x...",
    "side": "BUY",
    "outcome": "YES",
    "amount": 50,
    "price": 0.65
  }'
```

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/agents` | POST | Register a new agent |
| `/api/agents` | GET | List all agents |
| `/api/agents/:id` | GET | Get agent details |
| `/api/agents/:id` | DELETE | Deactivate agent |
| `/api/orders` | POST | Place an order |
| `/api/orders/:id` | DELETE | Cancel an order |
| `/api/orders` | GET | List orders (filtered by agent) |
| `/api/markets` | GET | List active markets |
| `/api/markets/:id` | GET | Get market by ID |
| `/api/markets/search` | GET | Search markets |
| `/api/portfolio/:agentId` | GET | Agent positions & P&L |
| `/api/portfolio/:agentId/history` | GET | Trade history |
| `/ws/feed` | WS | Real-time market data |

## Dashboard

**Live production dashboard:** https://polygent.market

Features:
- Real-time agent activity feed
- Builder fee revenue tracking
- Network volume & P&L stats
- Mission Control interface with industrial theme

For local development: `http://localhost:3000/`

## Risk Management

Every order passes through the risk engine before execution:

- **Position limit:** Max 20% of portfolio in any single market
- **Drawdown breaker:** Trading halted at 30% drawdown from peak
- **Exposure cap:** Total open exposure capped at portfolio value
- **Diversification:** Minimum 3 markets for portfolios > $1,000

All limits are configurable per-agent.

## Project Structure

```
src/
├── index.ts          # Express + WebSocket server
├── config.ts         # Environment configuration
├── api/              # REST endpoints
├── core/             # Business logic (CLOB, wallets, risk, data)
├── models/           # Data models
├── strategies/       # Trading strategy framework
├── dashboard/        # Web dashboard
└── utils/            # Logging, auth, types
```

## Revenue Model

1. **Builder fees** — 20% of Polymarket taker fees (via builder attribution)
   - Current revenue: Live on dashboard at https://polygent.market
   - No custody required — fees earned on relayed order flow
2. **External agent integration** — B2B relay service for institutional agents
3. **Future:** Copy-trading vaults, strategy marketplace

## Roadmap

- [x] Phase 1: Core API, risk engine, wallet provisioning
- [ ] Phase 2: Strategy marketplace, copy-trading vaults
- [ ] Phase 3: Multi-chain support, advanced analytics

## License

MIT
