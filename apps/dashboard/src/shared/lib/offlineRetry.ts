/**
 * The retry policy for replaying offline sales: how a failure is classified,
 * and how long to wait before trying again.
 *
 * This is the single place that decides retryable vs terminal. A server error
 * code that should start being retried is added here and nowhere else.
 *
 * The distinction matters in both directions: retrying a rejection the server
 * will never accept is the busy loop this module exists to end, just slower --
 * and parking a transient failure forces a cashier to re-ring a sale that
 * would have gone through on its own.
 */

import { ApiError } from './transport/types';
import { SPLIT_PAYMENT_MISMATCH_CODE } from './checkout';

/**
 * Both are 409s and they are easy to conflate. `IDEMPOTENCY_UNRESOLVED` means
 * a concurrent twin held the claim past the server's lock timeout -- nothing
 * conflicts and the server's own message says to retry. `IDEMPOTENCY_KEY_REUSED`
 * means the key now identifies a different payload, which no amount of waiting
 * fixes. Mirrors `server/src/http/idempotency.ts`, which puts the code in
 * `details[0].code` under a generic `CONFLICT`.
 */
const IDEMPOTENCY_UNRESOLVED = 'IDEMPOTENCY_UNRESOLVED';
const IDEMPOTENCY_KEY_REUSED = 'IDEMPOTENCY_KEY_REUSED';

/** First backoff step. Doubles per consecutive retryable failure. */
export const RETRY_BASE_MS = 1_000;
/** Backoff never grows past this, so a recovered server is retried promptly. */
export const RETRY_CEILING_MS = 5 * 60 * 1_000;
/**
 * Attempts a retryable failure may consume before the entry parks.
 *
 * The ladder is 1s, 2s, 4s ... 256s, then the 5-minute ceiling, so this many
 * attempts is roughly 43 minutes of trying (511s of doubling plus 7 ceiling
 * steps). That is deliberately longer than any routine server restart:
 * parking a legitimate sale forces the cashier to re-ring it, which is the
 * more expensive mistake. It is affordable only because every replay carries
 * the same `Idempotency-Key`, so retrying cannot double-charge -- shrink this
 * if that ever stops being true.
 */
export const MAX_RETRYABLE_ATTEMPTS = 17;
/**
 * Every till in the shop comes back on the same `online` event and would
 * otherwise retry in lockstep against a server that just restarted.
 */
export const RETRY_JITTER = 0.2;

/** Applies +/-RETRY_JITTER to a delay, rounded to whole milliseconds. */
export function jitter(delayMs: number): number {
  return Math.round(delayMs * (1 - RETRY_JITTER + Math.random() * 2 * RETRY_JITTER));
}

/**
 * Delay before attempt `attempts + 1`, given `attempts` consecutive failures
 * so far. Exported so tests assert the policy rather than a hard-coded ladder.
 */
export function nextAttemptDelay(attempts: number, minDelayMs = 0): number {
  const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1);
  return jitter(Math.min(Math.max(exponential, minDelayMs), RETRY_CEILING_MS));
}

/** How a failed replay should be recorded. */
export interface FailureOutcome {
  retryable: boolean;
  reason: string;
  /** Floor for the next backoff step, for a failure that says how long to wait. */
  minDelayMs?: number;
}

/** Short, stable reasons -- persisted on the entry and shown to support. */
export const FAILURE_REASON = {
  network: 'network',
  serverError: 'server-error',
  timeout: 'timeout',
  rateLimited: 'rate-limited',
  unauthorized: 'unauthorized',
  idempotencyUnresolved: 'idempotency-unresolved',
  idempotencyKeyReused: 'idempotency-key-reused',
  splitMismatch: 'split-mismatch',
  rejected: 'rejected',
  unexpected: 'unexpected',
  /** A retryable failure on an entry with no idempotency key -- see useOffline. */
  unguardedReplay: 'unguarded-replay',
} as const;

export function classifyFailure(error: unknown): FailureOutcome {
  // Not an ApiError means the throw came from the replay code itself, not the
  // server. Park it so the defect reaches a human instead of retrying forever.
  if (!(error instanceof ApiError)) {
    return { retryable: false, reason: FAILURE_REASON.unexpected };
  }

  const codes = error.details?.map((detail) => detail.code) ?? [];
  if (codes.includes(SPLIT_PAYMENT_MISMATCH_CODE)) {
    return { retryable: false, reason: FAILURE_REASON.splitMismatch };
  }
  if (codes.includes(IDEMPOTENCY_KEY_REUSED)) {
    return { retryable: false, reason: FAILURE_REASON.idempotencyKeyReused };
  }
  if (codes.includes(IDEMPOTENCY_UNRESOLVED)) {
    return { retryable: true, reason: FAILURE_REASON.idempotencyUnresolved };
  }

  // http.ts leaves the status null when the request never reached the server.
  if (error.status === null) {
    return { retryable: true, reason: FAILURE_REASON.network };
  }
  if (error.status >= 500) {
    return { retryable: true, reason: FAILURE_REASON.serverError };
  }
  if (error.status === 408) {
    return { retryable: true, reason: FAILURE_REASON.timeout };
  }
  if (error.status === 429) {
    // Retrying a rate limiter on the 1s base step earns a longer ban, so this
    // one failure carries its own floor rather than climbing to it.
    return {
      retryable: true,
      reason: FAILURE_REASON.rateLimited,
      minDelayMs: RETRY_CEILING_MS,
    };
  }
  if (error.status === 401) {
    // Retryable because the transport's refresh interceptor may recover it.
    // Note what happens when it cannot: the interceptor's auth-failure path
    // logs out, and the logout handler in app/session.ts calls clearQueue() --
    // so the queue is discarded before this classification is ever applied.
    // That is a real defect, tracked separately; it is not "moot".
    return { retryable: true, reason: FAILURE_REASON.unauthorized };
  }

  // Any other 4xx is deterministic: a replay produces the identical rejection.
  return { retryable: false, reason: FAILURE_REASON.rejected };
}
