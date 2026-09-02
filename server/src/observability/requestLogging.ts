/**
 * The per-request observability line.
 *
 * One `http_request` log line per finished request, carrying the correlation id, the
 * normalized route, the outcome class, the duration, and who the actor was. This line is
 * the metrics transport (see `metrics.ts`): request rate is its count, latency is
 * `duration_ms`, error rate and the HTTP-vs-business split are `outcome`.
 *
 * What is *not* in it is the point. No request body, no headers, no cookies, no query
 * *values* — only allow-listed query key *names*, which is the rule this file inherited
 * from the middleware it replaces. An allow-list cannot leak a field nobody anticipated,
 * which is why redaction here is structural rather than a list of things to strip.
 * `logger`'s scrubber is the second layer, not the first.
 */
import type { NextFunction, Request, Response } from 'express';
import logger from '../../lib/logger';
import { correlationMiddleware, currentContext, type RequestContext } from './correlation';
import { classifyOutcome, recordBusinessFailure, recordRequest } from './metrics';
import { isHealthPath } from './probePaths';
import { mapPublicError } from '../http/errors';

/**
 * Query parameters whose *names* may be logged. Values never are: a `search` value is
 * customer-typed free text and can hold a name or a phone number.
 */
const allowedQueryKeys = new Set([
  'page',
  'pageSize',
  'sortBy',
  'sortOrder',
  'status',
  'categoryId',
  'lowStock',
  'dateFrom',
  'dateTo',
  'paymentMethod',
  'cashierId',
]);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Collapses identifiers out of a path: `/api/v1/products/482` becomes
 * `/api/v1/products/:id`.
 *
 * Two reasons, and the second is the load-bearing one. Cardinality: a `path` field with a
 * distinct value per record makes "error rate for this route" un-aggregatable. And
 * leakage: a path segment can *be* the datum — `/api/v1/customers/by-phone/+9715…` —
 * so the safe default is that a segment which looks like an identifier never reaches the
 * log store at all.
 */
export function normalizeRoutePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (segment === '') return segment;
      if (/^\d+$/.test(segment)) return ':id';
      if (UUID.test(segment)) return ':id';
      // Barcodes, SKUs, gift-card codes: long and mostly digits.
      if (/^[A-Za-z0-9_-]{12,}$/.test(segment) && /\d/.test(segment)) return ':id';
      return segment;
    })
    .join('/');
}

interface ActorMeta {
  user_id?: number | string;
  user_role?: string;
}

/**
 * Actor metadata is the id and the role — never the email or the name, both of which are
 * personal data and neither of which an operator needs to find the user. `req.user` is
 * populated by `verifyToken` inside the routers, which have run by the time the response
 * finishes, so this reads correctly despite the middleware being mounted first.
 */
function actorOf(req: Request): ActorMeta {
  const user = (req as Request & { user?: { id?: number | string; role?: string } }).user;
  if (!user) return {};
  return {
    ...(user.id === undefined ? {} : { user_id: user.id }),
    ...(user.role === undefined ? {} : { user_role: user.role }),
  };
}

/**
 * Logs the finished request and feeds the metrics registry.
 *
 * Health probes are logged at `debug`: a probe every ten seconds is 8,640 lines a day per
 * instance that say nothing, and an operator who has learned to filter `http_request`
 * lines out is an operator who cannot use them. They are still counted in the metrics —
 * silenced, not dropped.
 */
function logFinished(
  req: Request,
  res: Response,
  durationMs: number,
  context: RequestContext | undefined
): void {
  const rawPath = `${req.baseUrl || ''}${req.path}` || '/';
  const path = normalizeRoutePath(rawPath);
  const outcome = classifyOutcome(res.statusCode);

  recordRequest(outcome, durationMs);
  if (outcome === 'business_rule') {
    recordBusinessFailure(`${req.method} ${path}:${context?.errorCode ?? res.statusCode}`);
  }

  const queryKeys = Object.keys(req.query)
    .filter((key) => allowedQueryKeys.has(key))
    .sort();

  const level = isHealthPath(rawPath)
    ? res.statusCode >= 500
      ? 'error'
      : 'debug'
    : res.statusCode >= 500
      ? 'error'
      : res.statusCode >= 400
        ? 'warn'
        : 'info';

  logger[level](`${req.method} ${path} ${res.statusCode}`, {
    event: 'http_request',
    request_id: context?.requestId,
    ...(context?.clientRequestId ? { client_request_id: context.clientRequestId } : {}),
    method: req.method,
    path,
    query_keys: queryKeys,
    status: res.statusCode,
    outcome,
    ...(context?.errorCode ? { error_code: context.errorCode } : {}),
    duration_ms: durationMs,
    ...actorOf(req),
  });
}

/**
 * Timing and the finished-request line. Mounted by `observabilityMiddleware` below;
 * exported separately so a test can drive it without an ALS context.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  /*
   * The context is captured here rather than read inside the listener. `finish` is
   * emitted by the writable stream when the response flushes, which is not guaranteed to
   * happen inside the async context this middleware runs in — reading the store from the
   * listener silently loses the correlation id on exactly the slow responses worth
   * tracing. The object is shared, so a later `errorClassifier` mutation is still seen.
   */
  const context = currentContext();
  res.on('finish', () => logFinished(req, res, Date.now() - start, context));
  next();
}

/**
 * Correlation plus request logging, in the order they have to run: the id must exist
 * before anything can log under it.
 */
export function observabilityMiddleware(req: Request, res: Response, next: NextFunction): void {
  correlationMiddleware(req, res, () => requestLogger(req, res, next));
}

/**
 * Error-boundary tap. Records the public error code on the request context so the
 * finished-request line can carry it, then re-throws into the real error handler.
 *
 * A separate tap rather than a change to `errorHandler` so that classification is
 * observability's concern and stays beside the rest of it; `mapPublicError` is pure, so
 * calling it twice costs nothing and cannot diverge from what the client is told.
 */
export function errorClassifier(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction
): void {
  const context = currentContext();
  if (context) context.errorCode = mapPublicError(err).body.error.code;
  next(err);
}
