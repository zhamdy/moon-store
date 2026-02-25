import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import errorHandler from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { sanitizeBody } from './middleware/sanitize';
import logger from './lib/logger';
import db from './db';

import { routeTable, cleanupExpiredReservations } from './routes';

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT: number = Number(process.env.PORT) || 3001;

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ];

app.use(
  cors({
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Input sanitization (strip HTML/XSS vectors from request body strings)
app.use(sanitizeBody);

// Request logging
app.use(requestLogger);

// Static files (product images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
for (const [routePath, router] of routeTable) {
  app.use(routePath, router);
}

// Health check (includes DB connectivity test)
app.get('/api/health', (_req: Request, res: Response) => {
  try {
    db.db.prepare('SELECT 1').get();
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  } catch {
    res.status(503).json({ success: false, error: 'Database unreachable' });
  }
});

// Error handler
app.use(errorHandler);

// Cleanup expired reservations every 5 minutes
const cleanupInterval = setInterval(cleanupExpiredReservations, 5 * 60 * 1000);

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
});

const server = app.listen(PORT, () => {
  logger.info(`MOON Fashion API running on port ${PORT}`);
});

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down gracefully`);
  clearInterval(cleanupInterval);
  server.close(() => {
    logger.info('HTTP server closed');
    db.db.close();
    logger.info('Database connection closed');
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
