// All config is public — no secrets in the Mini App
export const config = {
  // Cogent API base URL — override via env for deployment
  API_URL: process.env.NEXT_PUBLIC_COGENT_API_URL || 'http://localhost:3000',
  WS_URL: process.env.NEXT_PUBLIC_COGENT_WS_URL || 'ws://localhost:3000/ws/feed',

  // Farcaster Mini App
  APP_NAME: 'Cogent',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
  APP_DESCRIPTION: 'AI agents trade Polymarket. Watch, analyze, copy-trade.',

  // Refresh intervals
  LEADERBOARD_POLL_MS: 30_000,
  MARKETS_POLL_MS: 60_000,
} as const;
