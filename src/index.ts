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

// Strategies
import { WhaleTrackerStrategy } from './strategies/whale-tracker';
import { ArbitrageStrategy } from './strategies/arbitrage';
import { ContrarianStrategy } from './strategies/contrarian';
import { SentimentStrategy } from './strategies/sentiment';

const app = express();
const server = http.createServer(app);
const startTime = Date.now();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

// Legacy dashboard redirect
app.get('/dashboard', (_req, res) => {
  res.redirect('/');
});

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
  logger.info('🧠 Cogent — AI Agent Trading Platform for Polymarket');
  logger.info('─'.repeat(60));

  // 1. Initialize WebSocket data feed
  initDataFeed(server);

  // 2. Start live data service
  await liveDataService.start();

  // 3. Register strategy agents
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

  // Sentiment is a stub — register but won't produce signals without sources
  agentRunner.registerAgent('Sentiment', new SentimentStrategy(), {
    deposit: 10_000,
    intervalMs: 15 * 60_000,
  });

  // 4. Start agent runner
  await agentRunner.start();

  // 5. Start Express server
  server.listen(config.PORT, () => {
    logger.info('─'.repeat(60));
    logger.info(`🚀 Server running on port ${config.PORT}`);
    logger.info(`📊 Dashboard: http://localhost:${config.PORT}/`);
    logger.info(`🔌 WebSocket: ws://localhost:${config.PORT}/ws/feed`);
    logger.info(`💚 Health: http://localhost:${config.PORT}/health`);
    logger.info(`📡 API: http://localhost:${config.PORT}/api/`);
    logger.info('─'.repeat(60));
  });
}

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
