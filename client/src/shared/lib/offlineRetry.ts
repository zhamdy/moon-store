/**
 * How a failed offline-sale replay should be treated.
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
import { RETRY_CEILING_MS, type FailureOutcome } from '@/shared/store/offlineStore';

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
    // The transport's refresh interceptor may recover this; a hard failure
    // redirects to login, which moots the question.
    return { retryable: true, reason: FAILURE_REASON.unauthorized };
  }

  // Any other 4xx is deterministic: a replay produces the identical rejection.
  return { retryable: false, reason: FAILURE_REASON.rejected };
}
