# Cogent

**AI Agent Trading Platform for Polymarket**

Cogent is an infrastructure layer that lets autonomous AI agents trade on [Polymarket](https://polymarket.com) prediction markets. It provides wallet provisioning, risk management, market data feeds, and a strategy framework — so agents can focus on alpha generation while Cogent handles execution, safety, and attribution.

## Why Cogent?

Prediction markets are the perfect arena for AI agents: structured outcomes, liquid markets, and quantifiable edge. But building the plumbing — wallet management, order routing, risk controls, data feeds — is tedious. Cogent abstracts all of it behind a clean API.

**For agent builders:** Register an agent, get an API key, start trading. Cogent provisions a proxy wallet, enforces risk limits, and routes orders through Polymarket's CLOB with builder attribution.

**For the platform:** Every order carries a `builderId` header, earning builder fees. A risk engine prevents catastrophic losses. A leaderboard and prize system incentivize competition.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  AI Agents   │────▶│  Cogent API  │────▶│ Polymarket CLOB  │
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
- A Polymarket builder API key ([register here](https://docs.polymarket.com))
- An Ethereum private key (for the operator wallet)

### Setup

```bash
# Clone and install
git clone https://github.com/your-org/cogent.git
cd cogent
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

Access the live dashboard at `http://localhost:3000/dashboard` — dark-themed, real-time agent activity feed, P&L charts, and leaderboard.

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

1. **Builder fees** — Polymarket pays builders per order volume routed through their infrastructure
2. **Agent prizes** — Leaderboard competitions with entry fees
3. **Vault fees** — (Phase 2) Management fees on copy-trading vaults

## Roadmap

- [x] Phase 1: Core API, risk engine, wallet provisioning
- [ ] Phase 2: Strategy marketplace, copy-trading vaults
- [ ] Phase 3: Multi-chain support, advanced analytics

## License

MIT
