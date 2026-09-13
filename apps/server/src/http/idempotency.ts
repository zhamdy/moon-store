/**
 * Idempotency protocol for retry-prone mutations.
 *
 * A caller-supplied `Idempotency-Key` makes a retried mutation return the ORIGINAL
 * outcome instead of creating a second one. The claim is inserted as the first statement
 * inside the business transaction, so it shares that transaction's fate:
 *
 *   - the mutation commits   -> the claim commits with it, and every later request with
 *                               that key replays the stored response
 *   - the mutation fails     -> the claim rolls back with it, and the client may retry
 *                               the same key against a fresh attempt
 *
 * That is what makes "exactly one committed outcome per key" true by construction: there
 * is no in-progress state, no lease to expire, and no stale-claim reaper. The accepted
 * cost is that a duplicate arriving mid-flight blocks on the unique index for the
 * duration of the winner's transaction — bounded, and only for genuine duplicates.
 *
 * A key therefore identifies a COMMITTED OUTCOME, never an attempt. One consequence
 * worth knowing: a deterministic 400 is not cached, so a corrected retry with the same
 * key runs normally.
 */
import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { withTransaction } from '../database/transaction';
import { getPool } from '../database/pool';
import { getEnv } from '../config/env';
import { PublicError } from './errors';
import logger from '../../lib/logger';

/** Request header carrying the key. Lowercased, as Express normalizes header names. */
export const IDEMPOTENCY_HEADER = 'idempotency-key';

/**
 * Response header flagging a replay. Signalling additively keeps the response envelope
 * and every existing field unchanged — a header is invisible to existing consumers.
 */
export const IDEMPOTENCY_REPLAY_HEADER = 'Idempotent-Replay';

/** Stable, client-matchable code for a key reused with different request details. */
export const IDEMPOTENCY_KEY_REUSED = 'IDEMPOTENCY_KEY_REUSED';

/**
 * Distinct from {@link IDEMPOTENCY_KEY_REUSED}: nothing conflicts, we simply could not
 * resolve the key against a settled outcome. Separate because the two demand opposite
 * client behavior — a reused key must NOT be retried, this one should be.
 */
export const IDEMPOTENCY_UNRESOLVED = 'IDEMPOTENCY_UNRESOLVED';

/**
 * Bounds how long a duplicate blocks on the claim's unique index. Without it the wait is
 * the winner's entire transaction, and each waiter holds a pooled connection meanwhile —
 * so a storm of duplicates on one key could starve the pool for every other till. Failing
 * fast turns that into a retryable error for the duplicate alone.
 */
const CLAIM_LOCK_TIMEOUT = '3s';

/**
 * The transaction rolls back wholesale on a deadlock, claim included, so a retry is a
 * genuinely fresh attempt. Safe here specifically because the non-transactional side
 * effects (notifications, audit) live in the controller, after this returns.
 */
const RETRY_DEADLOCKS = { retryOnSerializationFailure: true } as const;

export const IDEMPOTENCY_KEY_TTL_HOURS = 24;

const MAX_KEY_LENGTH = 255;
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;
const UNIQUE_VIOLATION = '23505';
/** Raised when `lock_timeout` expires while waiting to acquire a lock. */
const LOCK_NOT_AVAILABLE = '55P03';

/**
 * Raised when a key arrives with a different payload, endpoint, or user than the one it
 * already identifies. Deliberately carries nothing about the original request: the
 * caller of a reused key is not necessarily the caller that created it.
 */
export class IdempotencyConflictError extends Error {
  constructor(
    message = 'This Idempotency-Key was already used for a different request.',
    public readonly code: string = IDEMPOTENCY_KEY_REUSED,
    public readonly statusCode: number = 409
  ) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Deterministic JSON with recursively sorted object keys, so `{a,b}` and `{b,a}` produce
 * one fingerprint. Array order is preserved because it is semantically meaningful.
 * Non-finite numbers throw rather than silently serializing to `null`, which would make
 * two different payloads collide.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new PublicError('VALIDATION_ERROR', 'Request contains a non-finite number.');
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = canonicalize(source[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * SHA-256 over the canonical JSON of the payload. Callers pass the VALIDATED (post-Zod)
 * body, so key order, whitespace, and stripped unknown fields cannot raise a false
 * conflict between two requests that mean the same thing.
 */
export function fingerprintPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

/** A malformed key is a 400, never a silent bypass of the guarantee the caller asked for. */
export function assertValidIdempotencyKey(key: string): void {
  if (key.trim().length === 0) {
    throw new PublicError('VALIDATION_ERROR', `${IDEMPOTENCY_HEADER} must not be empty.`);
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new PublicError(
      'VALIDATION_ERROR',
      `${IDEMPOTENCY_HEADER} must be at most ${MAX_KEY_LENGTH} characters.`
    );
  }
  if (!PRINTABLE_ASCII.test(key)) {
    throw new PublicError(
      'VALIDATION_ERROR',
      `${IDEMPOTENCY_HEADER} must contain only printable ASCII characters.`
    );
  }
}

/**
 * Reads the caller's key off the request. Returns null when absent, which is what keeps
 * every wrapped endpoint working unchanged for a till that has not been updated yet.
 *
 * Shared rather than per-controller: the header name, the repeated-header rule, and the
 * absent-means-null contract have to be identical everywhere or the guarantee is uneven.
 */
export function readIdempotencyKey(req: {
  headers: Record<string, string | string[] | undefined>;
}): string | null {
  const raw = req.headers[IDEMPOTENCY_HEADER];
  if (Array.isArray(raw)) {
    // A repeated header has no single unambiguous key; refusing beats guessing.
    throw new PublicError('VALIDATION_ERROR', `Only one ${IDEMPOTENCY_HEADER} header is allowed.`);
  }
  return raw ?? null;
}

/**
 * Translates an idempotency conflict into the public error every wrapped endpoint
 * returns. Shared so the code, field, and status stay identical across them — a client
 * branching on `details[].code` must not have to learn per-endpoint variants.
 *
 * Returns null when the error is not a conflict, so a controller can fall through.
 */
export function toIdempotencyPublicError(error: unknown): PublicError | null {
  if (!(error instanceof IdempotencyConflictError)) {
    return null;
  }
  return new PublicError('CONFLICT', error.message, [
    { field: IDEMPOTENCY_HEADER, code: error.code, message: error.message },
  ]);
}

/** What the wrapped mutation produced, and how it should be replayed later. */
export interface IdempotentRun<T> {
  status: number;
  body: unknown;
  result: T;
  /** Lets an operator trace a key to its row without parsing the stored body. */
  resourceType?: string;
  resourceId?: number;
}

export interface IdempotentOutcome<T> {
  status: number;
  body: unknown;
  /** True when this response came from storage. Suppress side effects when it is. */
  replayed: boolean;
  /** The callback's return value, or null on a replay (the callback did not run). */
  result: T | null;
}

export interface WithIdempotencyOptions<T> {
  /** The caller's key, if any. Absent is allowed while IDEMPOTENCY_REQUIRED is false. */
  key?: string | null;
  /** Scope label, e.g. `POST /api/v1/sales`. Validated on replay, not part of the key. */
  endpoint: string;
  userId?: number | null;
  /** The validated request body. */
  payload: unknown;
  run: (client: PoolClient) => Promise<IdempotentRun<T>>;
}

/** Internal signal: the claim INSERT lost the race. Never escapes this module. */
class ClaimCollision extends Error {
  constructor() {
    super('Idempotency key already claimed');
    this.name = 'ClaimCollision';
  }
}

interface KeyRow {
  endpoint: string;
  user_id: number | null;
  request_fingerprint: string;
  response_status: number | null;
  response_body: unknown;
  expired: boolean;
}

export async function withIdempotency<T>(
  options: WithIdempotencyOptions<T>
): Promise<IdempotentOutcome<T>> {
  const { key, endpoint, userId = null, payload, run } = options;

  if (key === undefined || key === null) {
    if (getEnv().IDEMPOTENCY_REQUIRED) {
      throw new PublicError(
        'VALIDATION_ERROR',
        `An ${IDEMPOTENCY_HEADER} header is required for this request.`
      );
    }
    // Exactly today's behavior, minus the concurrency bugs: no row, no claim.
    const outcome = await withTransaction(run, undefined, RETRY_DEADLOCKS);
    return { status: outcome.status, body: outcome.body, replayed: false, result: outcome.result };
  }

  assertValidIdempotencyKey(key);
  const fingerprint = fingerprintPayload(payload);

  // At most one retry. The only reason to retry is that the winner rolled back and
  // released the key; looping on that would be unbounded for no extra correctness.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await claimAndRun({ key, endpoint, userId, fingerprint, run });
    } catch (error) {
      if (!(error instanceof ClaimCollision)) {
        throw error;
      }

      const existing = await readKeyRow(key);

      if (!existing) {
        // The winner rolled back and released the key. Try to claim it ourselves.
        continue;
      }

      if (existing.expired) {
        // Past its TTL, so it no longer identifies a live outcome. Clear it opportunistically
        // (this is the only reaper) and treat the key as fresh.
        await getPool().query(
          'DELETE FROM idempotency_keys WHERE key = $1 AND expires_at <= NOW()',
          [key]
        );
        continue;
      }

      if (
        existing.request_fingerprint !== fingerprint ||
        existing.endpoint !== endpoint ||
        existing.user_id !== userId
      ) {
        throw new IdempotencyConflictError();
      }

      if (existing.response_status === null) {
        // A committed claim with no stored outcome should be unreachable: the outcome is
        // written before COMMIT in the same transaction. Treat it as a conflict rather
        // than inventing a response.
        logger.error('Idempotency key committed without a stored response', { key, endpoint });
        throw new IdempotencyConflictError();
      }

      return {
        status: existing.response_status,
        body: existing.response_body,
        replayed: true,
        result: null,
      };
    }
  }

  // Two claim collisions in a row where the row then vanished each time. Refusing beats
  // looping. This is transient and carries no conflicting request, so it must NOT reuse
  // the reused-key code: a client that treats that code as permanent would give up on a
  // request it should simply send again.
  throw new IdempotencyConflictError(
    'Could not resolve this Idempotency-Key against a stable outcome. Please retry.',
    IDEMPOTENCY_UNRESOLVED
  );
}

async function claimAndRun<T>(args: {
  key: string;
  endpoint: string;
  userId: number | null;
  fingerprint: string;
  run: (client: PoolClient) => Promise<IdempotentRun<T>>;
}): Promise<IdempotentOutcome<T>> {
  const { key, endpoint, userId, fingerprint, run } = args;

  const outcome = await withTransaction(
    async (client) => {
      // Bounds only the claim's own wait; cleared immediately after so the business
      // callback's own statements are not held to a lock budget meant for the claim.
      await client.query(`SET LOCAL lock_timeout = '${CLAIM_LOCK_TIMEOUT}'`);

      // FIRST statement in the transaction. A concurrent duplicate blocks here until this
      // transaction ends, then either sees 23505 (we committed) or claims it (we rolled back).
      try {
        await client.query(
          `INSERT INTO idempotency_keys (key, endpoint, user_id, request_fingerprint, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + ($5 || ' hours')::interval)`,
          [key, endpoint, userId, fingerprint, String(IDEMPOTENCY_KEY_TTL_HOURS)]
        );
      } catch (error) {
        // Only THIS statement's unique violation means "a twin already holds the key".
        // A 23505 raised later by the business callback (a duplicate SKU, say) is a real
        // failure and must surface as itself, not be mistaken for a replay.
        if (isUniqueViolation(error)) {
          throw new ClaimCollision();
        }
        // The winner is taking longer than the claim's lock budget. Nothing is wrong and
        // nothing conflicts — tell the caller to try again rather than holding a pooled
        // connection for the rest of the winner's transaction.
        if (sqlState(error) === LOCK_NOT_AVAILABLE) {
          throw new IdempotencyConflictError(
            'This request is still being processed. Please retry.',
            IDEMPOTENCY_UNRESOLVED
          );
        }
        throw error;
      }

      // The claim is held; the business callback takes as long as it legitimately needs.
      await client.query(`SET LOCAL lock_timeout = 0`);

      const produced = await run(client);

      await client.query(
        `UPDATE idempotency_keys
          SET response_status = $2, response_body = $3, resource_type = $4, resource_id = $5
        WHERE key = $1`,
        [
          key,
          produced.status,
          JSON.stringify(produced.body),
          produced.resourceType ?? null,
          produced.resourceId ?? null,
        ]
      );

      return produced;
    },
    undefined,
    RETRY_DEADLOCKS
  );

  return { status: outcome.status, body: outcome.body, replayed: false, result: outcome.result };
}

async function readKeyRow(key: string): Promise<KeyRow | null> {
  const { rows } = await getPool().query<KeyRow>(
    `SELECT endpoint, user_id, request_fingerprint, response_status, response_body,
            (expires_at <= NOW()) AS expired
       FROM idempotency_keys
      WHERE key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

function sqlState(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return sqlState(error) === UNIQUE_VIOLATION;
}
