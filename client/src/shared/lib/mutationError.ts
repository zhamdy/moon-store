/**
 * The client-side mutation error contract: one classification of "the write
 * failed", derived only from signals the server actually sends.
 *
 * Why this exists: every page phrased its own failure handling, so the same
 * 401 was a red toast on one screen and a silent no-op on another, and a
 * validation rejection that names a field was flattened to a sentence the
 * cashier could not act on. This module is the single place that turns an
 * unknown thrown value into (a) what class of failure it was and (b) what the
 * user can DO about it.
 *
 * ## What the server actually sends
 *
 * `server/src/http/errors.ts` is the whole surface. Seven codes, and nothing
 * else ever reaches the wire:
 *
 *   VALIDATION_ERROR (400) · UNAUTHORIZED (401) · FORBIDDEN (403)
 *   NOT_FOUND (404) · CONFLICT (409) · RATE_LIMITED (429) · INTERNAL_ERROR (500)
 *
 * `details[]` carries `{ field, code, message }` triples, optionally with a
 * scalar `meta` — Zod issues for a validation rejection, and a handful of
 * hand-written domain codes riding under a generic parent
 * (`IDEMPOTENCY_KEY_REUSED` and `IDEMPOTENCY_UNRESOLVED` under CONFLICT,
 * `SPLIT_PAYMENT_MISMATCH` and `INSUFFICIENT_STOCK` under VALIDATION_ERROR).
 *
 * Deliberately NOT invented here: codes the server does not send. A code this
 * module recognises must be one some controller demonstrably puts on the wire,
 * because a code that never arrives reads as a contract that exists when it
 * does not.
 *
 * ## Message safety
 *
 * A server message is shown ONLY where the server authored it for a user:
 * VALIDATION_ERROR, CONFLICT, NOT_FOUND and FORBIDDEN. For 401, 429 and 5xx
 * the client's own translated wording is used instead — those messages are
 * either uninformative ("Internal server error") or carry authentication
 * detail that is not worth surfacing. Transport-level failures never have a
 * message at all: `transport/http.ts` deliberately blanks axios's wording, so
 * the fallback below is what the user sees.
 */
import { t } from '../i18n/index';
import { ApiError, type ValidationDetail } from './transport/types';

/**
 * The classes a mutation failure can land in. Chosen so that each one implies
 * exactly one recovery — if two kinds would offer the user the same action and
 * the same explanation, they should not be two kinds.
 */
export type MutationErrorKind =
  | 'validation'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'rateLimited'
  | 'offline'
  | 'network'
  | 'server'
  | 'unknown';

/**
 * What the user can do next. This is the point of the whole module: a class of
 * error with no recovery is just a colour of toast.
 *
 * - `fix`    — the input is wrong and is fixable in place. Keep the form open,
 *              keep every value, attach `fieldErrors` to the fields.
 * - `review` — the world moved under the request. Refresh what it depended on
 *              and let the user look before resubmitting. Never auto-retry.
 * - `retry`  — the request never got a verdict. The same submission again is
 *              safe (writes that matter carry an `Idempotency-Key`).
 * - `wait`   — a rate limit. Retrying now makes it worse.
 * - `signIn` — the session is gone. Re-authenticate and come back here.
 * - `none`   — nothing the user can do from this screen.
 */
export type MutationRecovery = 'fix' | 'review' | 'retry' | 'wait' | 'signIn' | 'none';

export interface MutationFailure {
  kind: MutationErrorKind;
  recovery: MutationRecovery;
  /** Safe, user-facing, translated where the client owns the wording. */
  message: string;
  /**
   * The server's own wording, present only for the kinds it phrases for a user
   * and only when non-empty. Callers use it to decide whether to prefer their
   * own domain sentence ("Failed to create customer") over the generic one:
   * the server's specific wording beats both, but a generic fallback should
   * not beat the caller's.
   */
  serverMessage?: string;
  /**
   * Field path -> message, for a `fix`. Empty for every other kind. Pages hand
   * this to React Hook Form's `setError` so the failure lands on the input
   * that caused it instead of in a toast that closes the dialog.
   */
  fieldErrors: Record<string, string>;
  /** The server's structured code, when it sent one. */
  code?: string;
  /** The server's `details[]`, verbatim, for callers that read domain codes. */
  details: ValidationDetail[];
  status: number | null;
  /**
   * Whether resubmitting the identical request could succeed. Note this is
   * about the request, not about whether the UI should retry automatically —
   * nothing here retries on its own.
   */
  retryable: boolean;
}

/**
 * Sent by both POS refusal paths, one detail per oversold line, with the
 * product, variant, requested and available in `meta`. POS reads it through
 * `features/pos/lib/stockConflict.ts` rather than parsing the message.
 */
export const INSUFFICIENT_STOCK_CODE = 'INSUFFICIENT_STOCK';

const RECOVERY: Record<MutationErrorKind, MutationRecovery> = {
  validation: 'fix',
  conflict: 'review',
  unauthorized: 'signIn',
  forbidden: 'none',
  notFound: 'review',
  rateLimited: 'wait',
  offline: 'retry',
  network: 'retry',
  server: 'retry',
  unknown: 'retry',
};

const RETRYABLE: Record<MutationErrorKind, boolean> = {
  validation: false,
  conflict: false,
  unauthorized: false,
  forbidden: false,
  notFound: false,
  rateLimited: true,
  offline: true,
  network: true,
  server: true,
  unknown: true,
};

/** Kinds whose message the server authored for a human to read. */
const SERVER_MESSAGE_KINDS: ReadonlySet<MutationErrorKind> = new Set<MutationErrorKind>([
  'validation',
  'conflict',
  'notFound',
  'forbidden',
]);

/** Translation key carrying the client's own wording for each kind. */
export function messageKeyFor(kind: MutationErrorKind): string {
  return `mutationError.${kind}`;
}

function kindFor(error: ApiError, online: boolean): MutationErrorKind {
  // `http.ts` leaves the status null when the request never reached the
  // server. Offline and network are the same HTTP fact and different user
  // facts: one is "your shop's link is down", the other "something ate that
  // request". Both retry, but the wording has to differ or the cashier is
  // told to check a connection that is fine.
  if (error.status === null) return online ? 'network' : 'offline';
  if (error.status >= 500) return 'server';

  switch (error.code) {
    case 'VALIDATION_ERROR':
      return 'validation';
    case 'CONFLICT':
      return 'conflict';
    case 'UNAUTHORIZED':
      return 'unauthorized';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'NOT_FOUND':
      return 'notFound';
    case 'RATE_LIMITED':
      return 'rateLimited';
    default:
      break;
  }

  // No code on the body — an older deploy, or a proxy that answered instead of
  // the app. Status is still trustworthy, so fall back to it rather than
  // calling a plain 404 "unknown".
  switch (error.status) {
    case 400:
      return 'validation';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 408:
      return 'network';
    case 409:
      return 'conflict';
    case 429:
      return 'rateLimited';
    default:
      return 'unknown';
  }
}

function fieldErrorsFrom(details: ValidationDetail[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const detail of details) {
    // A detail with no field is a whole-request complaint (the split-payment
    // mismatch is one). It belongs in the headline, not pinned to an input.
    if (!detail.field) continue;
    // First one wins: Zod reports the outermost failure first, which is the
    // one whose wording matches what the user typed.
    if (!(detail.field in fields)) fields[detail.field] = detail.message;
  }
  return fields;
}

/**
 * Turns anything a mutation can throw into the one shape the UI reasons about.
 *
 * `online` is injected rather than read inline so a test can drive the offline
 * branch without stubbing a global.
 */
export function classifyMutationError(
  error: unknown,
  online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine
): MutationFailure {
  if (!(error instanceof ApiError)) {
    // Not an ApiError means the throw came from our own code, not the server —
    // a bug in a mutationFn, a serialisation failure. Never show its message:
    // it is a developer string and may name internals.
    return {
      kind: 'unknown',
      recovery: RECOVERY.unknown,
      message: t(messageKeyFor('unknown')),
      fieldErrors: {},
      details: [],
      status: null,
      retryable: RETRYABLE.unknown,
    };
  }

  const kind = kindFor(error, online);
  const details = error.details ?? [];
  const serverMessage = SERVER_MESSAGE_KINDS.has(kind) ? error.message.trim() : '';

  return {
    kind,
    recovery: RECOVERY[kind],
    message: serverMessage || t(messageKeyFor(kind)),
    ...(serverMessage ? { serverMessage } : {}),
    fieldErrors: kind === 'validation' ? fieldErrorsFrom(details) : {},
    code: error.code,
    details,
    status: error.status,
    retryable: RETRYABLE[kind],
  };
}

/** True when `failure` carries the given domain code in its `details[]`. */
export function hasDetailCode(failure: MutationFailure, code: string): boolean {
  return failure.details.some((detail) => detail.code === code);
}
