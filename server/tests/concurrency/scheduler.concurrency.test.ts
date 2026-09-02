/**
 * Scheduled jobs under horizontal scaling.
 *
 * The claim in `scheduled_jobs` is a conditional upsert whose correctness rests entirely
 * on how READ COMMITTED re-evaluates an `ON CONFLICT DO UPDATE ... WHERE` after waiting on
 * the row lock. pg-mem has no MVCC and no advisory locks, so this is the only place the
 * "N instances, one execution" property can actually be proven.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { runScheduledJob } from '../../src/scheduler/runner';
import { reservationCleanupJob } from '../../src/scheduler/jobs';
import type { ScheduledJob } from '../../src/scheduler/types';

const INSTANCES = 8;

describeWithPostgres('scheduled jobs against real PostgreSQL', () => {
  let harness: RealPostgresHarness;
  let productId: number;

  beforeAll(async () => {
    // Every simulated instance holds a connection for the length of its run.
    harness = await setupRealPostgres('scheduler', { maxConnections: INSTANCES + 4 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();
    const { rows } = await harness.pool.query<{ id: number }>(
      `INSERT INTO products (name, sku, price, stock)
       VALUES ('Silk Scarf', 'SKU-SCHED-1', 100, 50) RETURNING id`
    );
    productId = rows[0].id;
  });

  async function seedExpiredReservations(count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      await harness.pool.query(
        `INSERT INTO stock_reservations (product_id, quantity, source_type, expires_at)
         VALUES ($1, 1, 'cart', NOW() - INTERVAL '1 minute')`,
        [productId]
      );
    }
  }

  function countingJob(overrides: Partial<ScheduledJob<number>> = {}) {
    let calls = 0;
    const job: ScheduledJob<number> = {
      name: 'race-job',
      intervalMs: 300_000,
      lockId: 4242,
      async run() {
        calls += 1;
        // Long enough that every competing caller is inside the runner at once.
        await new Promise((resolve) => setTimeout(resolve, 50));
        return calls;
      },
      ...overrides,
    };
    return { job, calls: () => calls };
  }

  it('runs once across simultaneous instances, and the losers say why they skipped', async () => {
    const { job, calls } = countingJob();

    const results = await Promise.all(
      Array.from({ length: INSTANCES }, () => runScheduledJob(job, { pool: harness.pool }))
    );

    expect(results.filter((r) => r.status === 'completed')).toHaveLength(1);
    expect(calls()).toBe(1);
    for (const skipped of results.filter((r) => r.status !== 'completed')) {
      expect(['skipped-locked', 'skipped-not-due']).toContain(skipped.status);
    }

    const { rows } = await harness.pool.query<{ run_count: number; last_status: string }>(
      'SELECT run_count, last_status FROM scheduled_jobs WHERE name = $1',
      [job.name]
    );
    expect(rows[0]).toMatchObject({ run_count: 1, last_status: 'success' });
  });

  it('does not repeat the work on a later tick inside the same interval', async () => {
    const { job, calls } = countingJob();

    expect((await runScheduledJob(job, { pool: harness.pool })).status).toBe('completed');
    expect((await runScheduledJob(job, { pool: harness.pool })).status).toBe('skipped-not-due');
    expect(calls()).toBe(1);
  });

  it('runs again once the interval has elapsed', async () => {
    const { job, calls } = countingJob({ intervalMs: 50 });

    expect((await runScheduledJob(job, { pool: harness.pool })).status).toBe('completed');
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect((await runScheduledJob(job, { pool: harness.pool })).status).toBe('completed');
    expect(calls()).toBe(2);

    const { rows } = await harness.pool.query<{ run_count: number }>(
      'SELECT run_count FROM scheduled_jobs WHERE name = $1',
      [job.name]
    );
    expect(Number(rows[0].run_count)).toBe(2);
  });

  it('records a failure and leaves the job runnable rather than wedged', async () => {
    let attempt = 0;
    const job: ScheduledJob<string> = {
      name: 'flaky-job',
      intervalMs: 1,
      lockId: 4243,
      async run() {
        attempt += 1;
        if (attempt === 1) throw new Error('transient outage');
        return 'recovered';
      },
    };

    const failed = await runScheduledJob(job, { pool: harness.pool });
    expect(failed).toMatchObject({ status: 'failed', error: 'transient outage' });

    const { rows } = await harness.pool.query<{
      last_status: string;
      last_detail: string;
      failure_count: number;
    }>('SELECT last_status, last_detail, failure_count FROM scheduled_jobs WHERE name = $1', [
      job.name,
    ]);
    expect(rows[0].last_status).toBe('failed');
    expect(rows[0].last_detail).toContain('transient outage');
    expect(Number(rows[0].failure_count)).toBe(1);

    // The advisory lock was released, so the retry is not blocked by the failed run.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await runScheduledJob(job, { pool: harness.pool })).toMatchObject({
      status: 'completed',
      outcome: 'recovered',
    });
  });

  it('deletes expired reservations exactly once across the fleet and reports the count', async () => {
    await seedExpiredReservations(3);
    await harness.pool.query(
      `INSERT INTO stock_reservations (product_id, quantity, source_type, expires_at)
       VALUES ($1, 2, 'cart', NOW() + INTERVAL '10 minutes')`,
      [productId]
    );

    const results = await Promise.all(
      Array.from({ length: INSTANCES }, () =>
        runScheduledJob(reservationCleanupJob, { pool: harness.pool })
      )
    );

    const completed = results.filter((r) => r.status === 'completed');
    expect(completed).toHaveLength(1);
    expect(completed[0].outcome).toEqual({ deleted: 3 });

    const { rows } = await harness.pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM stock_reservations'
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it('is safe to retry: a second forced run deletes nothing and still reports success', async () => {
    await seedExpiredReservations(2);

    const first = await runScheduledJob(reservationCleanupJob, { pool: harness.pool });
    expect(first.outcome).toEqual({ deleted: 2 });

    const second = await runScheduledJob(reservationCleanupJob, {
      pool: harness.pool,
      force: true,
    });
    expect(second).toMatchObject({ status: 'completed', outcome: { deleted: 0 } });

    const { rows } = await harness.pool.query<{ last_detail: string }>(
      'SELECT last_detail FROM scheduled_jobs WHERE name = $1',
      [reservationCleanupJob.name]
    );
    expect(rows[0].last_detail).toBe('{"deleted":0}');
  });
});
