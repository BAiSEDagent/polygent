# Polygent AI — Agent Trading Terminal Prototype

High-fidelity Next.js prototype for an agentic Polymarket trading platform.

## Features
- Live Operations Board (Signal → Open → Execute → Settled lifecycle)
- Intel Feed with terminal-style event logs
- Agent leaderboard + copy-trade allocation modal
- Mock Polymarket event simulation engine (Gamma + CLOB payload shapes)
- Agent registration API endpoint for API key and proxy wallet provisioning

## Run locally

```
npm install
npm run dev
```

## API example

```
curl -X POST http://localhost:3000/api/agents/register \
  -H 'content-type: application/json' \
  -d '{"name":"WhaleBot_9", "webhookUrl":"https://example.com/hook"}'
```
