/**
 * Liveness and readiness.
 *
 * Today's single `GET /api/health` runs `SELECT 1`. That is a *readiness* check wearing a
 * liveness name, and the difference is not cosmetic: an orchestrator responds to a failed
 * liveness probe by killing the process and to a failed readiness probe by taking the
 * instance out of rotation. Wire a database round-trip to liveness and a thirty-second
 * database blip becomes a rolling restart of every healthy API instance — each one
 * dropping its in-flight requests and its warm pool, all of them reconnecting at once
 * into the database that was already struggling. The outage is then caused by the
 * monitoring, which is the same failure mode the rate-limit exemption in #71 exists to
 * prevent.
 *
 * So:
 *
 *   `GET /api/health/live`  — is this process still a working Node process? It answers
 *                             from the event loop and touches nothing else. It fails only
 *                             when the process cannot serve at all (event loop wedged,
 *                             heap exhausted, port not accepting), which is exactly the
 *                             condition a restart fixes. It does *not* fail during
 *                             shutdown: the process is deliberately winding down, and
 *                             killing it harder cuts the drain short.
 *
 *   `GET /api/health/ready` — can this instance safely serve traffic *right now*? It
 *                             checks the database, because every non-trivial route needs
 *                             one, and it fails while shutting down so a load balancer
 *                             stops sending new work before the socket closes. Recovery
 *                             needs no intervention: the next probe passes when the
 *                             dependency returns.
 *
 *   `GET /api/health`       — unchanged, byte-for-byte, including its legacy
 *                             `{ success, data }` envelope. The E2E harness and the
 *                             Playwright `webServer` gate both wait on it, and Render's
 *                             health check points at it. It behaves as a readiness check,
 *                             which is what it always was.
 *
 * All three are exempt from the global rate limiter — see `isRateLimitExempt` in
 * `src/http/rateLimits.ts`, which must list every probe path here. A probe that spends
 * the shop's request budget is a monitoring-caused outage.
 */
import type { Request, Response } from 'express';
import db from '../database/pool';
import logger from '../../lib/logger';

/** How long a readiness database check may take before it is treated as a failure. */
export const READINESS_TIMEOUT_MS = 2000;

let shuttingDown = false;

/**
 * Flips readiness to failing. Called at the *top* of the shutdown handler, before the
 * server stops accepting: the gap between "stop being advertised" and "stop listening" is
 * the drain, and without it a load balancer keeps routing to a closing socket.
 */
export function beginShutdown(): void {
  shuttingDown = true;
}

export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Test seam — a module-level flag would otherwise leak between suites. */
export function resetShutdownState(): void {
  shuttingDown = false;
}

export interface DependencyCheck {
  status: 'ok' | 'failed';
  latency_ms: number;
  error?: string;
}

/**
 * `SELECT 1` under a hard timeout.
 *
 * The timeout is the point. A probe without one inherits the dependency's failure mode:
 * when PostgreSQL stops answering *without* refusing connections, an un-timed check hangs
 * until the prober's own timeout, so the instance neither passes nor fails and simply
 * stops reporting. A wedged dependency must read as `failed`, promptly.
 */
export async function checkDatabase(): Promise<DependencyCheck> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      db.query('SELECT 1'),
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`database check exceeded ${READINESS_TIMEOUT_MS}ms`)),
          READINESS_TIMEOUT_MS
        );
      }),
    ]);
    return { status: 'ok', latency_ms: Date.now() - started };
  } catch (err) {
    return {
      status: 'failed',
      latency_ms: Date.now() - started,
      // The driver's message names the host and the failure kind and carries no
      // credentials; `logger`'s scrubber removes a connection string if one ever appears.
      error: err instanceof Error ? err.message : 'unknown error',
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface ReadinessResult {
  ready: boolean;
  reason?: 'shutting_down' | 'dependency_unavailable';
  checks: { database: DependencyCheck };
}

export async function evaluateReadiness(): Promise<ReadinessResult> {
  const database = await checkDatabase();
  if (shuttingDown) {
    return { ready: false, reason: 'shutting_down', checks: { database } };
  }
  if (database.status === 'failed') {
    return { ready: false, reason: 'dependency_unavailable', checks: { database } };
  }
  return { ready: true, checks: { database } };
}

/**
 * Liveness. Deliberately trivial and deliberately dependency-free: answering at all is
 * the assertion. `uptime_s` is included because a liveness probe that keeps passing while
 * uptime keeps resetting is the signature of a crash loop.
 */
export function livenessHandler(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'alive',
    uptime_s: Math.round(process.uptime()),
    shutting_down: shuttingDown,
  });
}

export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  const result = await evaluateReadiness();
  if (!result.ready) {
    logger.warn('Readiness check failed', {
      reason: result.reason,
      database_status: result.checks.database.status,
      database_latency_ms: result.checks.database.latency_ms,
    });
  }
  res.status(result.ready ? 200 : 503).json({
    status: result.ready ? 'ready' : 'not_ready',
    ...(result.reason ? { reason: result.reason } : {}),
    checks: result.checks,
  });
}

/**
 * The pre-existing `/api/health`, preserved exactly — same envelope, same 503 message.
 * Callers outside this repo (`e2e/support/globalSetup.ts`, `render.yaml`) assert on this
 * shape, and an observability change is not the place to break them. New probes should
 * use `/live` and `/ready`.
 */
export async function legacyHealthHandler(_req: Request, res: Response): Promise<void> {
  const result = await evaluateReadiness();
  if (result.ready) {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
    return;
  }
  res.status(503).json({
    success: false,
    error: result.reason === 'shutting_down' ? 'Server shutting down' : 'Database unreachable',
  });
}

export { HEALTH_PATHS, isHealthPath } from './probePaths';
