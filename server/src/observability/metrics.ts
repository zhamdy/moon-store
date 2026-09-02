/**
 * Service metrics.
 *
 * **Transport decision: the structured log stream, not a `/metrics` endpoint.**
 *
 * The alternative considered was `prom-client` plus a Prometheus-style `GET /metrics`.
 * It was rejected for the same reason #46 used a PostgreSQL claim row instead of Redis:
 * it is not the metric shape that costs, it is the *component*. A scrape endpoint is only
 * a metrics system once somebody runs a Prometheus (or an agent) to scrape it, keeps it
 * reachable from the API's network, and maintains a second retention and alerting stack
 * beside the log pipeline that already exists. Nobody has agreed to run that. And the
 * endpoint is not free while it waits for one: it is a new unauthenticated surface whose
 * body enumerates every route and internal failure mode of the system.
 *
 * Every signal the issue names is derivable from the per-request line
 * `requestLogging.ts` already emits — request rate (count of `http_request` lines),
 * latency (`duration_ms`), error rate and the HTTP-vs-business split (`outcome`) — with
 * the exception of two that no per-request line can carry: database pool saturation, and
 * counts of critical business failures over time. Those are what the periodic
 * `service_metrics` snapshot below exists for.
 *
 * The registry is a module with a `snapshot()`, so if a scrape endpoint is later agreed
 * to, exposing one is a formatter over `snapshot()` — a small addition, not a redesign.
 *
 * Counters are cumulative since process start, which is what an aggregator's `rate()`
 * expects; a restart shows as a counter reset, and `uptime_s` in the same line is how a
 * reader tells a reset from a gap.
 */
import logger from '../../lib/logger';
import { poolStats } from '../database/pool';

/**
 * How a finished request is classified. The split the issue asks for — "metrics
 * distinguish HTTP failures from business validation failures" — is this enum:
 *
 *   - `success`       — 2xx/3xx.
 *   - `business_rule` — the request was well-formed and authorized, and the *domain*
 *                       rejected it: failed validation (400), a conflicting state (409),
 *                       an unprocessable entity (422). These are normal traffic. A shop
 *                       scanning an out-of-stock item produces them all day; alerting on
 *                       them as errors trains operators to ignore the alert.
 *   - `client_error`  — the caller got the protocol wrong or was refused: 401, 403, 404,
 *                       405, 415, 429. A spike here is an auth or client-version problem.
 *   - `server_error`  — 5xx. The only class that is unambiguously the server's fault, and
 *                       the one worth paging on.
 */
export type RequestOutcome = 'success' | 'business_rule' | 'client_error' | 'server_error';

/**
 * Status codes that mean "the domain said no", as opposed to "the request was wrong".
 * 400 is in both camps in principle; in this API a 400 is a `VALIDATION_ERROR` from a Zod
 * schema, which is a business validation failure, so it is classified as one.
 */
const BUSINESS_STATUSES = new Set([400, 409, 422]);

export function classifyOutcome(statusCode: number): RequestOutcome {
  if (statusCode >= 500) return 'server_error';
  if (statusCode >= 400) {
    return BUSINESS_STATUSES.has(statusCode) ? 'business_rule' : 'client_error';
  }
  return 'success';
}

/**
 * Latency histogram bucket upper bounds in milliseconds. Cumulative counts, so a reader
 * can estimate any percentile; the bounds are chosen around a POS checkout, where 250ms
 * is comfortable and 2.5s is a cashier waiting.
 */
export const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

interface HttpMetrics {
  total: number;
  byOutcome: Record<RequestOutcome, number>;
  durationSumMs: number;
  durationMaxMs: number;
  /** Cumulative counts: index i is "requests at or under LATENCY_BUCKETS_MS[i]". */
  buckets: number[];
  /** Requests slower than the largest bucket. */
  overflow: number;
}

function emptyHttp(): HttpMetrics {
  return {
    total: 0,
    byOutcome: { success: 0, business_rule: 0, client_error: 0, server_error: 0 },
    durationSumMs: 0,
    durationMaxMs: 0,
    buckets: LATENCY_BUCKETS_MS.map(() => 0),
    overflow: 0,
  };
}

let http = emptyHttp();
let businessFailures = new Map<string, number>();
let startedAt = Date.now();

export function recordRequest(outcome: RequestOutcome, durationMs: number): void {
  http.total += 1;
  http.byOutcome[outcome] += 1;
  http.durationSumMs += durationMs;
  if (durationMs > http.durationMaxMs) http.durationMaxMs = durationMs;
  let counted = false;
  for (let i = 0; i < LATENCY_BUCKETS_MS.length; i += 1) {
    if (durationMs <= LATENCY_BUCKETS_MS[i]) {
      http.buckets[i] += 1;
      counted = true;
      break;
    }
  }
  if (!counted) http.overflow += 1;
}

/**
 * Counts a business failure worth watching over time — a rejected checkout, a refused
 * refund, a gift-card redemption that did not apply.
 *
 * `kind` is a low-cardinality label chosen by the caller (`checkout.insufficient_stock`),
 * never an identifier: this map is unbounded by construction, and a per-sale label would
 * grow it without limit. The error boundary records `<route>:<code>` for every
 * `business_rule` outcome, which covers the endpoints generically; a module calls this
 * directly when it wants a failure named more precisely than its status code names it.
 */
export function recordBusinessFailure(kind: string): void {
  const label = kind.slice(0, 120);
  businessFailures.set(label, (businessFailures.get(label) ?? 0) + 1);
  // Bounded, so a caller that accidentally passes an identifier degrades the label set
  // rather than the process.
  if (businessFailures.size > 200) {
    const [oldest] = businessFailures.keys();
    businessFailures.delete(oldest);
  }
}

export interface MetricsSnapshot {
  uptime_s: number;
  requests_total: number;
  requests_by_outcome: Record<RequestOutcome, number>;
  latency_ms: {
    avg: number;
    max: number;
    buckets: Record<string, number>;
    over_5000: number;
  };
  db_pool: { total: number; idle: number; waiting: number } | null;
  business_failures: Record<string, number>;
}

export function snapshot(): MetricsSnapshot {
  const buckets: Record<string, number> = {};
  LATENCY_BUCKETS_MS.forEach((bound, i) => {
    buckets[`le_${bound}`] = http.buckets[i];
  });
  return {
    uptime_s: Math.round((Date.now() - startedAt) / 1000),
    requests_total: http.total,
    requests_by_outcome: { ...http.byOutcome },
    latency_ms: {
      avg: http.total === 0 ? 0 : Math.round(http.durationSumMs / http.total),
      max: http.durationMaxMs,
      buckets,
      over_5000: http.overflow,
    },
    db_pool: poolStats(),
    business_failures: Object.fromEntries(businessFailures),
  };
}

/** Test seam. Production never resets — a counter reset is what a restart looks like. */
export function resetMetrics(): void {
  http = emptyHttp();
  businessFailures = new Map();
  startedAt = Date.now();
}

export const DEFAULT_METRICS_INTERVAL_MS = 60_000;

/**
 * Resolves `METRICS_LOG_INTERVAL_MS`. `0` disables the snapshot line; anything that is not
 * a non-negative integer falls back to the default, the same posture `rateLimits.ts`
 * takes with its ceilings — a typo must not take a shop's logging cadence to `NaN`.
 */
export function resolveMetricsInterval(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_METRICS_INTERVAL_MS;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return DEFAULT_METRICS_INTERVAL_MS;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return DEFAULT_METRICS_INTERVAL_MS;
  if (parsed === 0) return 0;
  // A sub-second snapshot is a log flood, not a metric.
  return Math.max(parsed, 1000);
}

export interface MetricsReporter {
  stop: () => void;
}

/**
 * Emits `service_metrics` on an interval. The timer is `unref`'d so it never holds the
 * process open during shutdown, and one final line is emitted on `stop()` so the last
 * window before a deploy is not lost.
 */
export function startMetricsReporter(intervalMs: number): MetricsReporter {
  if (intervalMs === 0) {
    logger.info('service metrics snapshot disabled (METRICS_LOG_INTERVAL_MS=0)');
    return { stop: () => undefined };
  }
  const timer = setInterval(() => emitSnapshot(), intervalMs);
  timer.unref();
  return {
    stop: () => {
      clearInterval(timer);
      emitSnapshot();
    },
  };
}

export function emitSnapshot(): void {
  logger.info('service_metrics', { event: 'service_metrics', ...snapshot() });
}
