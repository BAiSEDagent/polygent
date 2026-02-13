# Threat Model — Cogent Mini App

## What This Is
A Next.js frontend running inside Farcaster clients (Warpcast, Base App) as a Mini App. Displays live AI agent trading data from the existing Cogent API. Users can spectate, view agent profiles, and share performance via composeCast.

## Trust Boundaries

```
[Farcaster Client (Warpcast/Base App)]
    │
    │ postMessage (iframe/WebView)
    │
[Cogent Mini App (Next.js, our code)]
    │
    │ HTTPS fetch + WebSocket
    │
[Cogent API Server (existing, localhost:3000)]
    │
    │ Internal
    │
[Paper Trading Engine / Live Data / CLOB]
```

### Boundary 1: Farcaster Client → Mini App
- **Trust level**: Semi-trusted. Farcaster SDK provides user context (FID, username) but we cannot trust it blindly.
- **Threat**: Spoofed FID in context. Malicious client sending fake postMessage events.
- **Mitigation**: Verify Farcaster context signatures. Never use FID alone for authorization. Read-only MVP means no state mutations from user identity.

### Boundary 2: Mini App → Cogent API
- **Trust level**: Our code talking to our server.
- **Threat**: If Mini App is served from a public URL, anyone can hit the API directly (not just via Farcaster).
- **Mitigation**: Public endpoints (leaderboard, markets, stats) are already public in our API. No new auth surface. Admin/agent endpoints already require API keys — Mini App never calls them.

### Boundary 3: User Browser → Mini App
- **Trust level**: Untrusted.
- **Threat**: XSS via market data (question text, agent names rendered in DOM). URL parameter injection.
- **Mitigation**: React auto-escapes JSX. No `dangerouslySetInnerHTML`. Sanitize any data before rendering. CSP headers.

## Input Boundaries

| Input | Source | Validation |
|-------|--------|------------|
| Farcaster context (FID, username) | SDK postMessage | Type-check, don't use for auth |
| URL params (agentId, marketId) | User/link | Alphanumeric + underscore only, max 64 chars |
| API responses (market data, trades) | Our server | Type-check before render, escape strings |
| WebSocket messages | Our server | JSON parse in try/catch, validate shape |

## Auth Model (MVP)
- **No user authentication in MVP.** All data is read-only and public.
- No wallet connection required to view.
- Future: wallet connect for copy-trading (Phase 2.1) — separate threat model needed.

## What "Fails Closed" Means Here
- API unreachable → show "connecting..." state, not broken UI
- WebSocket disconnect → graceful degradation to polling, not crash
- Invalid Farcaster context → render app anyway (no auth dependency)
- Malformed API data → skip rendering that item, don't throw

## Attack Surfaces

### 1. XSS via Market Data
- Market questions come from Polymarket (untrusted third-party content)
- Agent names come from our API (semi-trusted, already sanitized server-side)
- **Defense**: React JSX escaping + no raw HTML insertion + CSP

### 2. Clickjacking
- Mini App runs in an iframe — clickjacking is inherent to the model
- **Defense**: Farcaster clients control the iframe. We trust the host client. `X-Frame-Options` would break the Mini App. Accept this risk.

### 3. WebSocket Abuse
- Public WS endpoint could be hammered
- **Defense**: Existing server-side rate limits (100 connections, 5/IP, 50 subscriptions/client, 4KB message limit)

### 4. CORS
- Mini App served from different origin than API
- **Defense**: Add Mini App's deployed URL to `ALLOWED_ORIGINS` env var on server

### 5. Data Leakage
- Mini App must NOT expose: admin API key, agent private keys, operator wallet
- **Defense**: Mini App only calls public endpoints. No secrets in frontend code. No `.env` in the Mini App — all config is API URLs only.

## Acceptance Criteria
1. Arena view loads with live leaderboard data from `/api/leaderboard`
2. Agent Profile view shows stats, equity curve, recent trades
3. Markets view shows top markets with agent positions
4. WebSocket trade feed updates in real-time
5. composeCast generates shareable agent stats
6. No secrets in client bundle (verify with `grep` on build output)
7. CSP headers present
8. Works in Warpcast mobile WebView (424×695px)
9. Graceful degradation when API is down
10. Farcaster manifest served at `/.well-known/farcaster.json`
