/**
 * Idempotency helper — the transactional and concurrent half.
 *
 * Every assertion here depends on a transaction genuinely committing or rolling back, or
 * on two connections racing for the same unique index. pg-mem provides neither, so this
 * suite runs only against real PostgreSQL.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { resetEnvCache } from '../../src/config/env';
import {
  IDEMPOTENCY_KEY_REUSED,
  IdempotencyConflictError,
  fingerprintPayload,
  withIdempotency,
} from '../../src/http/idempotency';
import { withTransaction } from '../../src/database/transaction';

const ENDPOINT = 'POST /api/v1/sales';

describeWithPostgres('withIdempotency against real PostgreSQL', () => {
  let harness: RealPostgresHarness;
  let userId: number;

  beforeAll(async () => {
    harness = await setupRealPostgres('idempotency');
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    const { rows } = await harness.pool.query<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ('Cashier', 'c@moon.com', 'x', 'Cashier') RETURNING id"
    );
    userId = rows[0].id;
    delete process.env.IDEMPOTENCY_REQUIRED;
    resetEnvCache();
  });

  afterEach(() => {
    delete process.env.IDEMPOTENCY_REQUIRED;
    resetEnvCache();
  });

  function countingRun(status = 201, body: unknown = { success: true, data: { id: 1 } }) {
    let calls = 0;
    const run = async (_client: PoolClient) => {
      calls += 1;
      return { status, body, result: { id: 1 }, resourceType: 'sale', resourceId: 1 };
    };
    return { run, calls: () => calls };
  }

  async function keyRows() {
    const { rows } = await harness.pool.query('SELECT * FROM idempotency_keys');
    return rows;
  }

  describe('claim and replay', () => {
    it('runs the callback once and stores the outcome alongside its resource', async () => {
      const { run, calls } = countingRun();

      const outcome = await withIdempotency({
        key: 'k1',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 1 },
        run,
      });

      expect(calls()).toBe(1);
      expect(outcome.replayed).toBe(false);

      const rows = await keyRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        key: 'k1',
        endpoint: ENDPOINT,
        user_id: userId,
        response_status: 201,
        resource_type: 'sale',
        resource_id: 1,
      });
      expect(rows[0].request_fingerprint).toBe(fingerprintPayload({ a: 1 }));
      expect(new Date(rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('replays the stored outcome byte-identically without re-running the callback', async () => {
      const body = { success: true, data: { id: 42, total: '99.50', items: [{ product_id: 3 }] } };
      const first = countingRun(201, body);
      await withIdempotency({
        key: 'k2',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 1 },
        run: first.run,
      });

      const second = countingRun();
      const replay = await withIdempotency({
        key: 'k2',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 1 },
        run: second.run,
      });

      expect(second.calls()).toBe(0);
      expect(replay.replayed).toBe(true);
      expect(replay.status).toBe(201);
      expect(replay.body).toEqual(body);
      // Byte-identical, not merely deep-equal: the response the retrying caller receives
      // must serialize exactly as the first one did.
      expect(JSON.stringify(replay.body)).toBe(JSON.stringify(body));
      expect(replay.result).toBeNull();
      expect(await keyRows()).toHaveLength(1);
    });

    it('replays rather than conflicts when the payload differs only in key order', async () => {
      const first = countingRun();
      await withIdempotency({
        key: 'k3',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 1, b: { x: 1, y: 2 } },
        run: first.run,
      });

      const second = countingRun();
      const replay = await withIdempotency({
        key: 'k3',
        endpoint: ENDPOINT,
        userId,
        payload: { b: { y: 2, x: 1 }, a: 1 },
        run: second.run,
      });

      expect(second.calls()).toBe(0);
      expect(replay.replayed).toBe(true);
    });

    it('treats a key past expires_at as fresh and runs the callback again', async () => {
      const first = countingRun();
      await withIdempotency({
        key: 'k4',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 1 },
        run: first.run,
      });

      await harness.pool.query(
        "UPDATE idempotency_keys SET expires_at = NOW() - INTERVAL '1 hour' WHERE key = 'k4'"
      );

      const second = countingRun();
      const outcome = await withIdempotency({
        key: 'k4',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 1 },
        run: second.run,
      });

      expect(second.calls()).toBe(1);
      expect(outcome.replayed).toBe(false);
      // The expired row was replaced, not duplicated.
      expect(await keyRows()).toHaveLength(1);
    });
  });

  describe('conflicts', () => {
    const originalBody = { success: true, data: { secret: 'original body' } };

    async function seed(key: string, payload: unknown, endpoint = ENDPOINT, user = () => userId) {
      const { run } = countingRun(201, originalBody);
      await withIdempotency({ key, endpoint, userId: user(), payload, run });
    }

    it('rejects the same key with a different payload without running the callback', async () => {
      await seed('c1', { a: 1 });
      const { run, calls } = countingRun();

      await expect(
        withIdempotency({ key: 'c1', endpoint: ENDPOINT, userId, payload: { a: 2 }, run })
      ).rejects.toBeInstanceOf(IdempotencyConflictError);

      expect(calls()).toBe(0);
      expect(await keyRows()).toHaveLength(1);
    });

    it('carries IDEMPOTENCY_KEY_REUSED and never discloses the original response', async () => {
      await seed('c2', { a: 1 });
      const { run } = countingRun();

      const error = (await withIdempotency({
        key: 'c2',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 2 },
        run,
      }).catch((e: unknown) => e)) as IdempotencyConflictError;

      expect(error).toBeInstanceOf(IdempotencyConflictError);
      expect(error.code).toBe(IDEMPOTENCY_KEY_REUSED);
      expect(error.statusCode).toBe(409);
      expect(error.message).not.toContain('original body');
      expect(JSON.stringify(error.message)).not.toContain('secret');
    });

    it('rejects the same key arriving on a different endpoint', async () => {
      await seed('c3', { a: 1 });
      const { run, calls } = countingRun();

      await expect(
        withIdempotency({
          key: 'c3',
          endpoint: 'POST /api/v1/exchanges',
          userId,
          payload: { a: 1 },
          run,
        })
      ).rejects.toBeInstanceOf(IdempotencyConflictError);

      expect(calls()).toBe(0);
    });

    it('rejects the same key arriving from a different user', async () => {
      await seed('c4', { a: 1 });
      const { rows } = await harness.pool.query<{ id: number }>(
        "INSERT INTO users (name, email, password_hash, role) VALUES ('Other', 'o@moon.com', 'x', 'Cashier') RETURNING id"
      );
      const { run, calls } = countingRun();

      await expect(
        withIdempotency({
          key: 'c4',
          endpoint: ENDPOINT,
          userId: rows[0].id,
          payload: { a: 1 },
          run,
        })
      ).rejects.toBeInstanceOf(IdempotencyConflictError);

      expect(calls()).toBe(0);
    });
  });

  describe('a failed mutation releases its key', () => {
    it('rolls back the claim when the callback throws, so the key can be retried', async () => {
      const boom = new Error('insufficient stock');

      await expect(
        withIdempotency({
          key: 'f1',
          endpoint: ENDPOINT,
          userId,
          payload: { a: 1 },
          run: async () => {
            throw boom;
          },
        })
      ).rejects.toBe(boom);

      // A key identifies a committed outcome, never a failed attempt.
      expect(await keyRows()).toHaveLength(0);

      const retry = countingRun();
      const outcome = await withIdempotency({
        key: 'f1',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 1 },
        run: retry.run,
      });

      expect(retry.calls()).toBe(1);
      expect(outcome.replayed).toBe(false);
      expect(await keyRows()).toHaveLength(1);
    });

    it('surfaces a unique violation raised by the callback instead of treating it as a replay', async () => {
      await harness.pool.query(
        "INSERT INTO products (name, sku, price, stock) VALUES ('Existing', 'SKU-TAKEN', 10, 1)"
      );

      // A 23505 from the business logic is a real failure. Only the claim INSERT's own
      // unique violation means "a committed twin already holds this key".
      await expect(
        withIdempotency({
          key: 'f3',
          endpoint: ENDPOINT,
          userId,
          payload: { a: 1 },
          run: async (client) => {
            await client.query(
              "INSERT INTO products (name, sku, price, stock) VALUES ('Clash', 'SKU-TAKEN', 10, 1)"
            );
            throw new Error('unreachable');
          },
        })
      ).rejects.toMatchObject({ code: '23505' });

      expect(await keyRows()).toHaveLength(0);
    });

    it('leaves no partial work behind when the callback writes and then throws', async () => {
      await expect(
        withIdempotency({
          key: 'f2',
          endpoint: ENDPOINT,
          userId,
          payload: { a: 1 },
          run: async (client) => {
            await client.query(
              "INSERT INTO products (name, sku, price, stock) VALUES ('Doomed', 'SKU-DOOM', 10, 1)"
            );
            throw new Error('later failure');
          },
        })
      ).rejects.toThrow('later failure');

      const products = await harness.pool.query("SELECT id FROM products WHERE sku = 'SKU-DOOM'");
      expect(products.rows).toHaveLength(0);
      expect(await keyRows()).toHaveLength(0);
    });
  });

  describe('concurrent duplicates', () => {
    it('runs the callback exactly once for N simultaneous requests with one key', async () => {
      const CONCURRENCY = 8;
      let calls = 0;

      const attempts = Array.from({ length: CONCURRENCY }, () =>
        withIdempotency({
          key: 'race',
          endpoint: ENDPOINT,
          userId,
          payload: { a: 1 },
          run: async (client) => {
            calls += 1;
            // Hold the transaction open so every duplicate is genuinely blocked on the
            // unique index rather than arriving after the winner has already committed.
            await client.query('SELECT pg_sleep(0.15)');
            const { rows } = await client.query<{ id: number }>(
              "INSERT INTO products (name, sku, price, stock) VALUES ('Raced', 'SKU-RACE', 10, 1) RETURNING id"
            );
            return {
              status: 201,
              body: { success: true, data: { id: rows[0].id } },
              result: { id: rows[0].id },
              resourceType: 'sale',
              resourceId: rows[0].id,
            };
          },
        })
      );

      const outcomes = await Promise.all(attempts);

      expect(calls).toBe(1);
      expect(outcomes).toHaveLength(CONCURRENCY);
      expect(outcomes.filter((o) => !o.replayed)).toHaveLength(1);
      expect(outcomes.filter((o) => o.replayed)).toHaveLength(CONCURRENCY - 1);

      // Every caller sees the same status and the same body.
      const bodies = new Set(outcomes.map((o) => JSON.stringify(o.body)));
      expect(bodies.size).toBe(1);
      expect(new Set(outcomes.map((o) => o.status))).toEqual(new Set([201]));

      // Exactly one committed outcome, and exactly one side effect.
      expect(await keyRows()).toHaveLength(1);
      const products = await harness.pool.query('SELECT id FROM products');
      expect(products.rows).toHaveLength(1);
    });

    it('lets a second caller win the key when the first transaction rolls back', async () => {
      let firstStarted: () => void = () => {};
      const firstIsRunning = new Promise<void>((resolve) => {
        firstStarted = resolve;
      });

      const failing = withIdempotency({
        key: 'handoff',
        endpoint: ENDPOINT,
        userId,
        payload: { a: 1 },
        run: async (client) => {
          firstStarted();
          await client.query('SELECT pg_sleep(0.2)');
          throw new Error('first attempt failed');
        },
      }).catch((e: unknown) => e);

      await firstIsRunning;

      const second = countingRun();
      const [firstResult, secondOutcome] = await Promise.all([
        failing,
        withIdempotency({
          key: 'handoff',
          endpoint: ENDPOINT,
          userId,
          payload: { a: 1 },
          run: second.run,
        }),
      ]);

      expect(firstResult).toBeInstanceOf(Error);
      expect(second.calls()).toBe(1);
      expect(secondOutcome.replayed).toBe(false);
      expect(await keyRows()).toHaveLength(1);
    });
  });

  describe('withTransaction retry', () => {
    it('retries a deadlock (40P01) and ultimately commits once', async () => {
      let attempts = 0;

      const result = await withTransaction(
        async (client) => {
          attempts += 1;
          if (attempts < 3) {
            const error = new Error('deadlock detected') as Error & { code: string };
            error.code = '40P01';
            throw error;
          }
          await client.query(
            "INSERT INTO products (name, sku, price, stock) VALUES ('Retried', 'SKU-RETRY', 10, 1)"
          );
          return 'committed';
        },
        undefined,
        { retryOnSerializationFailure: true }
      );

      expect(result).toBe('committed');
      expect(attempts).toBe(3);

      const { rows } = await harness.pool.query("SELECT id FROM products WHERE sku = 'SKU-RETRY'");
      expect(rows).toHaveLength(1);
    });

    it('gives up after the retry budget and propagates the original error', async () => {
      let attempts = 0;

      await expect(
        withTransaction(
          async () => {
            attempts += 1;
            const error = new Error('serialization failure') as Error & { code: string };
            error.code = '40001';
            throw error;
          },
          undefined,
          { retryOnSerializationFailure: true, maxRetries: 2 }
        )
      ).rejects.toThrow('serialization failure');

      expect(attempts).toBe(3);
    });

    it('does not retry a non-retryable error, and does not retry at all by default', async () => {
      let optedIn = 0;
      await expect(
        withTransaction(
          async () => {
            optedIn += 1;
            throw new Error('business rule violated');
          },
          undefined,
          { retryOnSerializationFailure: true }
        )
      ).rejects.toThrow('business rule violated');
      expect(optedIn).toBe(1);

      let defaulted = 0;
      await expect(
        withTransaction(async () => {
          defaulted += 1;
          const error = new Error('deadlock detected') as Error & { code: string };
          error.code = '40P01';
          throw error;
        })
      ).rejects.toThrow('deadlock detected');
      expect(defaulted).toBe(1);
    });
  });
});
