import dotenv from 'dotenv';
dotenv.config();

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function generateRandomKey(): string {
  const crypto = require('crypto');
  return `dev_${crypto.randomBytes(32).toString('hex')}`;
}

function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  return raw !== undefined ? Number(raw) : fallback;
}

// Admin API key configuration with security checks
function getAdminApiKey(): string {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (nodeEnv === 'production') {
    if (!adminKey || adminKey === 'dev-admin-key') {
      throw new Error(
        'ADMIN_API_KEY must be set to a secure value in production. ' +
        'Cannot use default "dev-admin-key" in production mode.'
      );
    }
    return adminKey;
  }
  
  // Development mode: generate random key if not set
  if (!adminKey || adminKey === 'dev-admin-key') {
    const randomKey = generateRandomKey();
    console.log(`🔑 Dev admin key: ${randomKey.slice(0, 8)}...`);
    return randomKey;
  }
  
  return adminKey;
}

export const config = {
  // Server
  PORT: envNum('PORT', 3000),
  NODE_ENV: env('NODE_ENV', 'development'),
  ADMIN_API_KEY: getAdminApiKey(),

  // Polymarket CLOB
  POLYMARKET_CLOB_URL: env('POLYMARKET_CLOB_URL', 'https://clob.polymarket.com'),
  BUILDER_ID: env('BUILDER_ID', ''),
  BUILDER_API_KEY: env('BUILDER_API_KEY', ''),

  // Data APIs
  GAMMA_API_URL: env('GAMMA_API_URL', 'https://gamma-api.polymarket.com'),
  DATA_API_URL: env('DATA_API_URL', 'https://data-api.polymarket.com'),
  SPORTS_API_URL: env('SPORTS_API_URL', 'https://sports-api.polymarket.com'),
  SPORTS_WS_URL: env('SPORTS_WS_URL', 'wss://sports-api.polymarket.com/ws'),

  // Operator wallet
  OPERATOR_PRIVATE_KEY: env('OPERATOR_PRIVATE_KEY', ''),
  
  // Polymarket proxy/funder wallet (Gnosis Safe address)
  FUNDER_ADDRESS: env('FUNDER_ADDRESS', ''),

  // Risk defaults
  DEFAULT_MAX_POSITION_PCT: envNum('DEFAULT_MAX_POSITION_PCT', 0.20),
  DEFAULT_MAX_DRAWDOWN_PCT: envNum('DEFAULT_MAX_DRAWDOWN_PCT', 0.30),
  DEFAULT_MAX_ORDER_SIZE: envNum('DEFAULT_MAX_ORDER_SIZE', 10_000),
  DEFAULT_DAILY_LOSS_LIMIT_PCT: envNum('DEFAULT_DAILY_LOSS_LIMIT_PCT', 0.15),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: envNum('RATE_LIMIT_WINDOW_MS', 60_000),
  RATE_LIMIT_MAX_REQUESTS: envNum('RATE_LIMIT_MAX_REQUESTS', 100),

  // Trading mode: 'paper' or 'live'
  TRADING_MODE: env('TRADING_MODE', 'paper') as 'paper' | 'live',

  // Live trading limits
  MAX_ORDER_SIZE: envNum('MAX_ORDER_SIZE', 5),
  MAX_TOTAL_EXPOSURE: envNum('MAX_TOTAL_EXPOSURE', 50),

  // Logging
  LOG_LEVEL: env('LOG_LEVEL', 'info'),

  // Gamma cache TTL (ms)
  GAMMA_CACHE_TTL: envNum('GAMMA_CACHE_TTL', 30_000),
} as const;
