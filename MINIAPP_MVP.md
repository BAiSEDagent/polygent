# Cogent Mini App MVP — Scope

## What It Is
Cogent's agent trading dashboard as a Base Mini App inside Farcaster (Warpcast, Base App). Users tap a link in their feed → see live AI agents trading Polymarket → copy-trade or spectate. Zero install.

## Views (3 screens)

### 1. Arena (Home)
- Live agent leaderboard: name, strategy, P&L%, equity, win rate
- Real-time trade feed scrolling at bottom (agent bought YES on "Will X happen" at $0.63)
- Tap agent → Agent Profile

### 2. Agent Profile
- Performance chart (equity curve)
- Strategy description, stats (Sharpe, drawdown, trade count)
- Recent trades list
- **"Copy This Agent" button** → creates sub-account, mirrors trades (Phase 2.1)
- **"Share" button** → composeCast with agent stats card as OG image

### 3. Markets
- Top markets by volume with agent activity overlay
- Which agents are positioned where, aggregate sentiment
- Tap market → see all agent positions in that market

## Tech Stack
- **Next.js 15** + OnchainKit + MiniKit
- **`@base-org/account`** for sub-accounts (gas-sponsored)
- **`@farcaster/miniapp-sdk`** for context, composeCast, wallet
- **Cogent API** as backend (already built — /api/leaderboard, /api/runners, /api/markets, /api/activity)
- **WebSocket** for real-time trade feed (already built at /ws/feed)

## What We Reuse From Existing Cogent
- ALL backend API endpoints — no changes needed
- WebSocket data feed
- Paper trading engine + risk engine
- Agent runner + strategies
- Leaderboard + portfolio calculations

## What We Build New
- Next.js Mini App frontend (replaces current React SPA for Farcaster context)
- Farcaster manifest + meta tags
- OG image generator for shared agent stats
- Sub-account integration for copy-trading (Phase 2.1)

## Manifest
```json
{
  "miniapp": {
    "version": "1",
    "name": "Cogent",
    "iconUrl": "https://cogent.app/icon.png",
    "homeUrl": "https://cogent.app",
    "splashImageUrl": "https://cogent.app/splash.png",
    "splashBackgroundColor": "#0A0A0F",
    "webhookUrl": "https://cogent.app/api/webhook",
    "requiredChains": ["eip155:8453"],
    "requiredCapabilities": ["wallet.getEthereumProvider", "actions.composeCast"],
    "description": "AI agents trade Polymarket. Watch, analyze, copy-trade.",
    "tags": ["trading", "ai", "prediction-markets"]
  }
}
```

## Viral Loops
1. **Share agent performance** → composeCast with stats card → others tap → open Cogent
2. **"My agent is up 47%"** posts in Farcaster feed → curiosity clicks
3. **Market predictions** → "Cogent agents think YES at 73% on [market]" → shareable takes

## Revenue in Mini App Context
- Builder fees still flow (all trades go through our CLOB integration)
- Copy-trading subscription: 5 USDC/mo via sub-account auto-pay
- Premium agent access: top-performing agents gated behind payment
- All payments on Base via smart wallet — no credit cards, no KYC

## Timeline
- **Week 1**: Next.js Mini App scaffold, wire to existing Cogent API, Arena + Agent Profile views
- **Week 2**: Farcaster manifest, OG images, composeCast sharing, deploy to Vercel
- **Week 3**: Sub-account integration, copy-trade MVP
- **Week 4**: Polish, launch in Farcaster, first viral cast

## Why This Wins
- **Distribution**: 500K+ Farcaster users, zero acquisition cost
- **Friction**: Zero. Tap link → live dashboard. No wallet setup (sub-accounts handle it)
- **Virality**: Built-in sharing via composeCast, agent performance as social content
- **Base-native**: Smart wallets, gas sponsorship, USDC payments — all on Base
- **Moat**: Real AI agents with real strategies, not just a price feed wrapper

## Open Questions
- Host Cogent API on Vercel or separate VPS? (WebSocket needs persistent connection)
- OG image generation: Vercel OG (@vercel/og) or custom canvas?
- Do we keep the standalone React frontend too, or go all-in on Mini App?
