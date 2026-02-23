import express from 'express';
import http from 'http';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import apiRoutes from './api/routes';
import { initDataFeed, getConnectedClientCount } from './core/data-feed';
import { liveDataService } from './core/live-data';
import { agentRunner } from './core/agent-runner';
import { paperTrader } from './core/paper-trader';
import { agentStore } from './models/agent';
import { tradeStore } from './models/trade';
import { initLiveTrader } from './core/live-trader';
import { installConsoleRedaction } from './utils/redact';

// Strategies
import { WhaleTrackerStrategy } from './strategies/whale-tracker';
import { ArbitrageStrategy } from './strategies/arbitrage';
import { ContrarianStrategy } from './strategies/contrarian';
import { SentimentStrategy } from './strategies/sentiment';
import { MeanReversionStrategy } from "./strategies/mean-reversion";
import { MarketMakerStrategy } from './strategies/market-maker';
import { fullSetArbObserver } from './services/fullset-observer';

// Redact credential-like values from dependency console logs
installConsoleRedaction();

const app = express();
const server = http.createServer(app);
const startTime = Date.now();

// Trust Nginx reverse proxy
app.set("trust proxy", 1);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));

// Secure CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost:3000', 'https://polygent.market', 'https://www.polygent.market',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
];

app.use(cors({
  origin: (origin: string | undefined, callback) => {
    // Allow requests with no origin (curl, server-to-server) ONLY in dev
    if (!origin) {
      return callback(null, config.NODE_ENV === 'development');
    }
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Reduce JSON body size limit to 100KB for security
app.use(express.json({ limit: '100kb' }));

app.use(
  '/api/',
  rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  })
);

app.use((req, _res, next) => {
  if (req.path !== '/health') {
    logger.debug(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 50),
    });
  }
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api', apiRoutes);

// /sign at root for SDK compatibility (BuilderConfig remote URL = "https://polygent.market/sign")
import builderSignRouter from './api/builder-sign';
app.use('/sign', builderSignRouter);

// Health check
app.get('/health', (_req, res) => {
  const stats = liveDataService.getStats();
  res.json({
    status: 'ok',
    version: '0.2.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    agents: agentStore.count(),
    openOrders: tradeStore.getOpenOrderCount(),
    wsClients: getConnectedClientCount(),
    liveData: stats,
  });
});

// Frontend — serve React app from frontend/dist
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));


// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 for API routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  logger.info('🧠 Polygent — AI Agent Trading Platform for Polymarket');
  logger.info('─'.repeat(60));

  // 1. Initialize WebSocket data feed
  initDataFeed(server);

  // 2. Start live data service
  await liveDataService.start();

  // 2.5. Initialize live trader if in live mode
  if (config.NODE_ENV !== 'production' || process.env.TRADING_MODE === 'live') {
    if (process.env.TRADING_MODE === 'live' && process.env.PK) {
      try {
        initLiveTrader();
        logger.info('💰 LIVE TRADING MODE — real orders will be placed');
        logger.warn('⚠️  Max order: $' + (process.env.MAX_ORDER_SIZE || '5') + ', Max exposure: $' + (process.env.MAX_TOTAL_EXPOSURE || '50'));
      } catch (err) {
        logger.error('Failed to init live trader, falling back to paper', { error: (err as Error).message });
      }
    } else {
      logger.info('📝 Paper trading mode (set TRADING_MODE=live to trade real money)');
    }
  }

  // 3. Register strategy agents (skip in production if no real keys)
  try {
  agentRunner.registerAgent('Whale Tracker', new WhaleTrackerStrategy(), {
    deposit: 10_000,
    intervalMs: 5 * 60_000, // 5 min
  });

  agentRunner.registerAgent('Arbitrage Scanner', new ArbitrageStrategy(), {
    deposit: 10_000,
    intervalMs: 2 * 60_000, // 2 min (arb needs speed)
  });

  agentRunner.registerAgent('Contrarian', new ContrarianStrategy(), {
    deposit: 10_000,
    intervalMs: 10 * 60_000, // 10 min
  });

  agentRunner.registerAgent("Mean Reversion", new MeanReversionStrategy(), {
    deposit: 6,
    intervalMs: 60_000, // 1 min — needs frequent ticks for Z-score
  });
  // Sentiment is a stub — register but won't produce signals without sources
  agentRunner.registerAgent('Sentiment', new SentimentStrategy(), {
    deposit: 10_000,
    intervalMs: 15 * 60_000,
  });

  // Market Maker — passive spread provisioning on high-liquidity crypto markets.
  // 15-second refresh rate for active quote management.
  // Tracks maker_fees separately for spread revenue attribution.
  agentRunner.registerAgent('Market Maker', new MarketMakerStrategy(), {
    deposit: 10_000,
    intervalMs: 15_000, // 15-second refresh — active quote management
  });

  } catch (agentErr: any) {
    logger.warn("Skipping internal agents (no real keys)", { error: agentErr.message });
  }

  // 4. Start agent runner
  await agentRunner.start();

  // 4b. Start Full-Set Arb Observer (OBSERVE mode — zero trades, pure data collection)
  // Scans BTC/ETH 5m/15m markets every 20s, logs opportunities, reports every 30min.
  // Check /api/fullset/report for live stats.
  fullSetArbObserver.start();

  // 5. Start Express server
  const bindHost = process.env.BIND_ALL === 'true' ? '0.0.0.0' : '127.0.0.1';
  server.listen(config.PORT, bindHost, () => {
    logger.info('─'.repeat(60));
    logger.info(`🚀 Server running on ${bindHost}:${config.PORT}`);
    logger.info(`📊 Dashboard: http://localhost:${config.PORT}/`);
    logger.info(`🔌 WebSocket: ws://localhost:${config.PORT}/ws/feed`);
    logger.info(`💚 Health: http://localhost:${config.PORT}/health`);
    logger.info(`📡 API: http://localhost:${config.PORT}/api/`);
    if (bindHost === '127.0.0.1') {
      logger.info('🔒 Bound to localhost only - set BIND_ALL=true to bind to all interfaces');
    }
    logger.info('─'.repeat(60));
  });
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason: String(reason) });
  // Don't crash — log and continue
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception — shutting down', { error: error.message, stack: error.stack });
  // Graceful shutdown
  shutdown().then(() => process.exit(1));
});

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');
  agentRunner.stop();
  liveDataService.stop();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, server };
