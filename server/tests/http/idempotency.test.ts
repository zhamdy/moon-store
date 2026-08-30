/**
 * Idempotency helper — the parts provable without real transactions.
 *
 * Canonicalization, fingerprinting, key validation, and the no-key compatibility path
 * live here on pg-mem. Everything that depends on a transaction actually committing or
 * rolling back is in `tests/concurrency/idempotency.concurrency.test.ts`: pg-mem's pg
 * adapter does not honour ROLLBACK, so a claim-release assertion would pass there for
 * the wrong reason.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import type { Pool as PgPool, PoolClient } from 'pg';
import { createPgMemPool } from '../support/pgMem';
import { setPool, closePool } from '../../src/database/pool';
import { runMigrationsUp } from '../../src/database/migrate';
import { resetEnvCache } from '../../src/config/env';
import { PublicError } from '../../src/http/errors';
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY_REUSED,
  IDEMPOTENCY_REPLAY_HEADER,
  IDEMPOTENCY_KEY_TTL_HOURS,
  IdempotencyConflictError,
  assertValidIdempotencyKey,
  canonicalJson,
  fingerprintPayload,
  withIdempotency,
} from '../../src/http/idempotency';

const ENDPOINT = 'POST /api/v1/sales';

let testPool: PgPool;

beforeAll(async () => {
  testPool = createPgMemPool();
  setPool(testPool);
  await runMigrationsUp(testPool, path.join(__dirname, '../../src/database/migrations'));
});

afterAll(async () => {
  await closePool();
});

beforeEach(async () => {
  await testPool.query('DELETE FROM idempotency_keys');
  delete process.env.IDEMPOTENCY_REQUIRED;
  resetEnvCache();
});

afterEach(() => {
  delete process.env.IDEMPOTENCY_REQUIRED;
  resetEnvCache();
});

function countingRun(status = 201, body: unknown = { success: true, data: { id: 1 } }) {
  const calls: PoolClient[] = [];
  const run = async (client: PoolClient) => {
    calls.push(client);
    return { status, body, result: { id: 1 }, resourceType: 'sale', resourceId: 1 };
  };
  return { run, calls };
}

async function keyRows(): Promise<Record<string, unknown>[]> {
  const { rows } = await testPool.query('SELECT * FROM idempotency_keys');
  return rows;
}

describe('canonicalJson', () => {
  it('sorts object keys recursively so field order cannot change the fingerprint', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
    expect(canonicalJson({ o: { x: 1, y: 2 }, n: 3 })).toBe(
      canonicalJson({ n: 3, o: { y: 2, x: 1 } })
    );
  });

  it('sorts keys inside array elements too', () => {
    expect(canonicalJson([{ a: 1, b: 2 }])).toBe(canonicalJson([{ b: 2, a: 1 }]));
  });

  it('preserves array order, which is semantically meaningful', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('distinguishes absent keys from null and from empty string', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 1, b: null }));
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({ a: '' }));
  });

  it('rejects non-finite numbers rather than serializing them as null', () => {
    expect(() => canonicalJson({ n: NaN })).toThrow(PublicError);
    expect(() => canonicalJson({ n: Infinity })).toThrow(PublicError);
    expect(() => canonicalJson({ nested: [{ n: -Infinity }] })).toThrow(PublicError);
  });
});

describe('fingerprintPayload', () => {
  it('is stable across key order and differs on any value change', () => {
    const a = fingerprintPayload({ items: [{ product_id: 1, quantity: 2 }], total: 10 });
    const b = fingerprintPayload({ total: 10, items: [{ quantity: 2, product_id: 1 }] });
    const c = fingerprintPayload({ items: [{ product_id: 1, quantity: 3 }], total: 10 });

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('distinguishes a numeric value from its string form', () => {
    expect(fingerprintPayload({ total: 10 })).not.toBe(fingerprintPayload({ total: '10' }));
  });
});

describe('assertValidIdempotencyKey', () => {
  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['over 255 characters', 'k'.repeat(256)],
    ['containing a control character', 'abcdef'],
    ['containing a newline', 'abc\ndef'],
    ['containing a non-ASCII character', 'abcédef'],
  ])('rejects a key that is %s', (_label, key) => {
    expect(() => assertValidIdempotencyKey(key)).toThrow(PublicError);
  });

  it.each([
    ['a UUID', '0f6a2b1c-1d3e-4f50-9a7b-2c8d9e0f1a2b'],
    ['255 characters', 'k'.repeat(255)],
  ])('accepts %s', (_label, key) => {
    expect(() => assertValidIdempotencyKey(key)).not.toThrow();
  });
});

describe('withIdempotency — no key supplied', () => {
  it('runs the callback and writes no row while the header is optional', async () => {
    const { run, calls } = countingRun();

    const outcome = await withIdempotency({ endpoint: ENDPOINT, payload: { a: 1 }, run });

    expect(calls).toHaveLength(1);
    expect(outcome.replayed).toBe(false);
    expect(outcome.status).toBe(201);
    expect(outcome.result).toEqual({ id: 1 });
    expect(await keyRows()).toHaveLength(0);
  });

  it('rejects the request when IDEMPOTENCY_REQUIRED is on, naming the header', async () => {
    process.env.IDEMPOTENCY_REQUIRED = 'true';
    resetEnvCache();
    const { run, calls } = countingRun();

    const error = await withIdempotency({ endpoint: ENDPOINT, payload: { a: 1 }, run }).catch(
      (e: unknown) => e as PublicError
    );

    expect(error).toBeInstanceOf(PublicError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message.toLowerCase()).toContain(IDEMPOTENCY_HEADER);
    expect(calls).toHaveLength(0);
  });
});

describe('withIdempotency — malformed key', () => {
  it('rejects before running the callback or writing a row', async () => {
    const { run, calls } = countingRun();

    await expect(
      withIdempotency({ key: '', endpoint: ENDPOINT, payload: { a: 1 }, run })
    ).rejects.toBeInstanceOf(PublicError);

    expect(calls).toHaveLength(0);
    expect(await keyRows()).toHaveLength(0);
  });
});

describe('IdempotencyConflictError', () => {
  it('carries the stable code and a 409, and discloses nothing about the original request', () => {
    const error = new IdempotencyConflictError();

    expect(error.code).toBe(IDEMPOTENCY_KEY_REUSED);
    expect(error.statusCode).toBe(409);
    expect(error.name).toBe('IdempotencyConflictError');
  });
});

describe('exported constants', () => {
  it('names the request and replay headers and the TTL', () => {
    expect(IDEMPOTENCY_HEADER).toBe('idempotency-key');
    expect(IDEMPOTENCY_REPLAY_HEADER).toBe('Idempotent-Replay');
    expect(IDEMPOTENCY_KEY_TTL_HOURS).toBe(24);
  });
});
