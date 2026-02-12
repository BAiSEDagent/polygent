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
import { agentStore } from './models/agent';
import { tradeStore } from './models/trade';

const app = express();
const server = http.createServer(app);
const startTime = Date.now();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting
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

// Request logging
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
  res.json({
    status: 'ok',
    version: '0.1.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    agents: agentStore.count(),
    openOrders: tradeStore.getOpenOrderCount(),
    wsClients: getConnectedClientCount(),
  });
});

// Dashboard
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────────────────────

initDataFeed(server);

server.listen(config.PORT, () => {
  logger.info(`🧠 Cogent server running on port ${config.PORT}`, {
    env: config.NODE_ENV,
    builderId: config.BUILDER_ID || '(not set)',
  });
  logger.info(`📊 Dashboard: http://localhost:${config.PORT}/dashboard`);
  logger.info(`🔌 WebSocket: ws://localhost:${config.PORT}/ws/feed`);
  logger.info(`💚 Health: http://localhost:${config.PORT}/health`);
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, server };
