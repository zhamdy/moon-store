import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { apiReference } from '@scalar/express-api-reference';
import errorHandler from '../middleware/errorHandler';
import { errorClassifier, observabilityMiddleware } from './observability/requestLogging';
import { legacyHealthHandler, livenessHandler, readinessHandler } from './observability/health';
import { sanitizeBody } from '../middleware/sanitize';
import { errorResponse } from './http/errors';
import { servedOpenApiSpec } from './docs/servedSpec';
import { routeTable } from './router';
import { getStorage, LocalStorageDriver } from './storage';
import {
  createGlobalLimiter,
  logRateLimitOverrides,
  logTrustProxyOverride,
  trustProxySetting,
} from './http/rateLimits';

/**
 * Builds the full request-handling Express app: every middleware in production order,
 * `router.ts` mounted, the 404 fallback. This is the app both `index.ts` and
 * `tests/http/contracts.test.ts` run — the whole point of extracting it is that there is
 * exactly one place that decides what a request to this API sees.
 *
 * Deliberately excluded: `.listen()`, process signal handlers, the scheduler, and the
 * metrics reporter. Those are process-lifecycle concerns, not request-handling ones, and
 * instantiating an app for a test must not start a background timer or open a real
 * database connection as a side effect. The DB pool and storage driver are both lazy
 * module-level singletons already test-safe via `setPool`/`setStorage` (see
 * `tests/setup.ts`), so building the app does not itself touch either for real.
 */
export function createApp(): express.Express {
  const app = express();

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
      storage instanceof LocalStorageDriver
        ? storage.rootDir
        : path.join(__dirname, '..', 'uploads')
    )
  );

  // Routes
  for (const [routePath, router] of routeTable) {
    app.use(routePath, router);
  }

  // OpenAPI Spec endpoint. Request shapes are derived from the Zod schemas that validate
  // them (#102); responses stay hand-written, because nothing validates a response.
  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(servedOpenApiSpec);
  });

  // Scalar API Reference documentation UI
  app.use(
    '/reference',
    apiReference({
      theme: 'moon',
      spec: {
        content: servedOpenApiSpec,
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

  return app;
}
