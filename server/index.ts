import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  createGlobalLimiter,
  logRateLimitOverrides,
  logTrustProxyOverride,
  trustProxySetting,
} from './src/http/rateLimits';
import cookieParser from 'cookie-parser';
import path from 'path';
import { apiReference } from '@scalar/express-api-reference';
import errorHandler from './middleware/errorHandler';
import { errorClassifier, observabilityMiddleware } from './src/observability/requestLogging';
import {
  beginShutdown,
  legacyHealthHandler,
  livenessHandler,
  readinessHandler,
} from './src/observability/health';
import { resolveMetricsInterval, startMetricsReporter } from './src/observability/metrics';
import { sanitizeBody } from './middleware/sanitize';
import logger from './lib/logger';
import { closePool } from './src/database/pool';
import { errorResponse } from './src/http/errors';
import { openApiSpec } from './src/docs/openapi';

import { routeTable } from './src/router';
import { startScheduler } from './src/scheduler';
import { getStorage, LocalStorageDriver } from './src/storage';

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

// How far to trust X-Forwarded-For when deriving `req.ip`, which is the rate-limit
// bucket for unauthenticated traffic. Defaults to off — Express's own default — so an
// unset TRUST_PROXY behaves exactly as before. See `src/http/rateLimits.ts`.
logTrustProxyOverride();
app.set('trust proxy', trustProxySetting());

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
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
      } else if (
        origin.endsWith('.vercel.app') &&
        allowedOrigins.some((o) => o.endsWith('.vercel.app'))
      ) {
        // Allow all Vercel preview/branch URLs when any Vercel domain is whitelisted
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

/**
 * Correlation id, request log line, metrics.
 *
 * Ahead of the rate limiter on purpose: a `429` is exactly the response a shop calls
 * support about, and without an id and a log line it is unattributable. Ahead of the body
 * parser too, so a request rejected for an oversized body still produces one.
 */
app.use(observabilityMiddleware);

// Rate limiting
logRateLimitOverrides();
app.use(createGlobalLimiter());

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Input sanitization (strip HTML/XSS vectors from request body strings)
app.use(sanitizeBody);

/**
 * Static files (product images).
 *
 * Only the filesystem driver needs a mount, and it serves the driver's own root rather
 * than a path spelled out again here — so pointing `MEDIA_LOCAL_ROOT` at a mounted volume
 * moves both the writes and the reads. A remote driver serves its own URLs and this mount
 * stays in place only to keep already-stored `/uploads/...` rows resolvable.
 */
const storage = getStorage();
app.use(
  '/uploads',
  express.static(
    storage instanceof LocalStorageDriver ? storage.rootDir : path.join(__dirname, 'uploads')
  )
);

// Routes
for (const [routePath, router] of routeTable) {
  app.use(routePath, router);
}

// OpenAPI Spec endpoint
app.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// Scalar API Reference documentation UI
app.use(
  '/reference',
  apiReference({
    theme: 'moon',
    spec: {
      content: openApiSpec,
    },
  })
);

/**
 * Health probes. Liveness answers from the event loop and touches no dependency, so a
 * database blip cannot get a healthy process killed; readiness checks the database and
 * fails while shutting down, so a load balancer drains before the socket closes. The
 * original `/api/health` keeps its exact legacy shape for the E2E harness and the deploy
 * health check. All three are rate-limit exempt via `observability/probePaths.ts`.
 * See `src/docs/OBSERVABILITY.md`.
 */
app.get('/api/health/live', livenessHandler);
app.get('/api/health/ready', readinessHandler);
app.get('/api/health', legacyHealthHandler);

app.use((_req: Request, res: Response) => {
  res.status(404).json(errorResponse('NOT_FOUND'));
});

// Error handler. `errorClassifier` only records the public error code on the request
// context — so the request log line can carry it — and hands the error straight on.
app.use(errorClassifier);
app.use(errorHandler);

/**
 * Background maintenance. Every instance ticks, but each job runs at most once per
 * interval across the whole fleet — the claim lives in `scheduled_jobs`, not in this
 * process. See `src/scheduler/index.ts`.
 */
const scheduler = startScheduler();

/**
 * Periodic `service_metrics` line: pool saturation and business-failure counts, the two
 * signals no per-request line can carry. The log stream is this service's metrics
 * transport — see `src/observability/metrics.ts` for why there is no `/metrics` endpoint.
 */
const metricsReporter = startMetricsReporter(
  resolveMetricsInterval(process.env.METRICS_LOG_INTERVAL_MS)
);

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
  /*
   * Readiness goes false first, before anything stops. The window between "this instance
   * stops advertising itself" and "this instance stops listening" is the drain: without
   * it the load balancer is still routing new checkouts at a socket that is closing, and
   * a cashier sees a connection reset instead of a retry against another instance.
   * Liveness deliberately keeps passing — the process is winding down on purpose, and a
   * failing liveness probe here would have the orchestrator SIGKILL the drain.
   */
  beginShutdown();
  scheduler.stop();
  metricsReporter.stop();
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await closePool();
      logger.info('Database connection closed');
    } catch (err: any) {
      logger.error('Error closing database pool', { error: err.message });
    }
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
