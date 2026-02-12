# External Whale Bot

A standalone agent that connects to [Cogent](../../) via its HTTP API as a third-party client.

## What it does

1. **Registers** with Cogent's API on startup (gets API key)
2. **Polls markets** every 2 minutes for top Polymarket markets
3. **Fetches whale positions** from Polymarket's Data API (its own intelligence source)
4. **Places paper trades** via Cogent when large whale moves are detected
5. **Tracks performance** via the portfolio API

## Running

```bash
# From this directory
npm install
COGENT_URL=http://localhost:3000 npm start

# Or with npx directly
COGENT_URL=http://localhost:3000 npx tsx index.ts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COGENT_URL` | `http://localhost:3000` | Cogent server URL |

## Architecture

This bot **only** communicates with Cogent via HTTP. It imports nothing from the Cogent codebase.

```
Polymarket Data API ──→ [Whale Bot] ──→ Cogent API
  (whale positions)       (analysis)     (paper trades)
```

The `cogent-client.ts` is a reusable SDK that any external agent can use.

## Key Principle

This bot could run on a completely different machine. It proves Cogent's API works for outside agents.
