/**
 * Scheduler runner — the parts that do not need real MVCC.
 *
 * The fleet-wide single-execution guarantee is a property of two genuinely concurrent
 * connections and lives in `tests/concurrency/scheduler.concurrency.test.ts`. What is
 * provable here is the runner's contract around that: which statements it issues, that it
 * always releases its lock, that a failure is reported rather than thrown, and that the
 * cleanup job reports what it deleted.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { runScheduledJob, ADVISORY_LOCK_NAMESPACE } from '../src/scheduler/runner';
import { reservationCleanupJob, JOB_LOCK_IDS } from '../src/scheduler/jobs';
import { startScheduler } from '../src/scheduler';
import { reservationsRepository } from '../src/modules/pos/reservations/repository';
import type { ScheduledJob } from '../src/scheduler/types';

interface FakeCall {
  sql: string;
  params: unknown[];
}

interface FakePoolOptions {
  locked?: boolean;
  claimed?: boolean;
  failOn?: (sql: string) => boolean;
}

function fakePool(options: FakePoolOptions = {}) {
  const { locked = true, claimed = true } = options;
  const calls: FakeCall[] = [];
  const releases: Array<Error | undefined> = [];

  const client = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (options.failOn?.(sql)) {
        throw new Error('query exploded');
      }
      if (sql.includes('pg_try_advisory_lock')) {
        return { rows: [{ locked }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO scheduled_jobs')) {
        return { rows: claimed ? [{ name: 'x' }] : [], rowCount: claimed ? 1 : 0 };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: (err?: Error) => {
      releases.push(err);
    },
  };

  const pool = { connect: async () => client } as unknown as Pool;

  return {
    pool,
    calls,
    sqls: () => calls.map((c) => c.sql),
    releasedCount: () => releases.length,
    releases: () => releases,
    matched: (needle: string) => calls.filter((c) => c.sql.includes(needle)),
  };
}

function job(run: () => Promise<unknown>, overrides: Partial<ScheduledJob> = {}): ScheduledJob {
  return { name: 'test-job', intervalMs: 300_000, lockId: 99, run, ...overrides };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runScheduledJob', () => {
  it('claims the slot, runs once, and records the outcome it reports', async () => {
    const fake = fakePool();
    const result = await runScheduledJob(
      job(async () => ({ deleted: 3 })),
      { pool: fake.pool }
    );

    expect(result).toMatchObject({ job: 'test-job', status: 'completed', outcome: { deleted: 3 } });

    const claim = fake.matched('INSERT INTO scheduled_jobs')[0];
    // name, due window (5 min), stale-claim takeover window (10 min default).
    expect(claim.params).toEqual(['test-job', 300, 600]);

    const record = fake.matched('UPDATE scheduled_jobs')[0];
    expect(record.params).toEqual(['test-job', 'success', '{"deleted":3}', 0]);
  });

  it('does not run the handler when another instance holds the lock', async () => {
    const fake = fakePool({ locked: false });
    const run = vi.fn(async () => ({ deleted: 1 }));

    const result = await runScheduledJob(job(run), { pool: fake.pool });

    expect(result.status).toBe('skipped-locked');
    expect(run).not.toHaveBeenCalled();
    expect(fake.matched('INSERT INTO scheduled_jobs')).toHaveLength(0);
    expect(fake.releasedCount()).toBe(1);
  });

  it('does not run the handler when the interval has not elapsed', async () => {
    const fake = fakePool({ claimed: false });
    const run = vi.fn(async () => ({ deleted: 1 }));

    const result = await runScheduledJob(job(run), { pool: fake.pool });

    expect(result.status).toBe('skipped-not-due');
    expect(run).not.toHaveBeenCalled();
    expect(fake.matched('pg_advisory_unlock')).toHaveLength(1);
  });

  it('reports a handler failure instead of throwing, and records it', async () => {
    const fake = fakePool();
    const result = await runScheduledJob(
      job(async () => {
        throw new Error('cleanup blew up');
      }),
      { pool: fake.pool }
    );

    expect(result).toMatchObject({ status: 'failed', error: 'cleanup blew up' });
    const record = fake.matched('UPDATE scheduled_jobs')[0];
    expect(record.params).toEqual(['test-job', 'failed', 'cleanup blew up', 1]);
  });

  it('releases the advisory lock on every path, so a failed run stays retryable', async () => {
    for (const handler of [
      async () => ({ ok: true }),
      async () => {
        throw new Error('boom');
      },
    ]) {
      const fake = fakePool();
      await runScheduledJob(job(handler), { pool: fake.pool });
      const unlock = fake.matched('pg_advisory_unlock')[0];
      expect(unlock.params).toEqual([ADVISORY_LOCK_NAMESPACE, 99]);
      expect(fake.releasedCount()).toBe(1);
    }
  });

  it('reports a failure rather than throwing when the database is unreachable', async () => {
    const pool = {
      connect: async () => {
        throw new Error('connection refused');
      },
    } as unknown as Pool;

    const run = vi.fn();
    const result = await runScheduledJob(job(run as never), { pool });

    expect(result).toMatchObject({ status: 'failed', error: 'connection refused' });
    expect(run).not.toHaveBeenCalled();
  });

  it('destroys a connection whose advisory lock could not be released', async () => {
    // A session that may still hold the lock must not go back into the pool: the next
    // borrower inherits it and the whole fleet reads `skipped-locked`.
    const fake = fakePool({ failOn: (sql) => sql.includes('pg_advisory_unlock') });

    const result = await runScheduledJob(
      job(async () => ({ ok: true })),
      { pool: fake.pool }
    );

    expect(result.status).toBe('completed');
    expect(fake.releases()).toHaveLength(1);
    expect(fake.releases()[0]).toBeInstanceOf(Error);
  });

  it('returns a healthy connection to the pool untouched', async () => {
    const fake = fakePool();
    await runScheduledJob(
      job(async () => ({ ok: true })),
      { pool: fake.pool }
    );
    expect(fake.releases()).toEqual([undefined]);
  });

  it('reports work that succeeded as completed even if the ledger write fails', async () => {
    // The DELETE has already committed. Calling that a failure would ask for a retry of
    // work that is already done, and would log an outage that did not happen.
    const fake = fakePool({ failOn: (sql) => sql.includes('UPDATE scheduled_jobs') });

    const result = await runScheduledJob(
      job(async () => ({ deleted: 9 })),
      { pool: fake.pool }
    );

    expect(result).toMatchObject({ status: 'completed', outcome: { deleted: 9 } });
    expect(result.error).toBeUndefined();
  });

  it('passes a per-job stale-claim window when one is set', async () => {
    const fake = fakePool();
    await runScheduledJob(
      job(async () => null, { staleAfterMs: 90_000 }),
      { pool: fake.pool }
    );
    expect(fake.matched('INSERT INTO scheduled_jobs')[0].params).toEqual(['test-job', 300, 90]);
  });

  it('bypasses the due window under force, but never the lock', async () => {
    const fake = fakePool();
    await runScheduledJob(
      job(async () => null),
      { pool: fake.pool, force: true }
    );
    expect(fake.matched('INSERT INTO scheduled_jobs')[0].params).toEqual(['test-job', 0, 0]);

    const locked = fakePool({ locked: false });
    const run = vi.fn(async () => null);
    const result = await runScheduledJob(job(run), { pool: locked.pool, force: true });
    expect(result.status).toBe('skipped-locked');
    expect(run).not.toHaveBeenCalled();
  });
});

describe('reservation cleanup job', () => {
  it('reports how many reservations it removed, and is safe to repeat', async () => {
    const deleteExpired = vi
      .spyOn(reservationsRepository, 'deleteExpired')
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(0);

    const first = fakePool();
    expect(await runScheduledJob(reservationCleanupJob, { pool: first.pool })).toMatchObject({
      status: 'completed',
      outcome: { deleted: 4 },
    });

    const second = fakePool();
    expect(
      await runScheduledJob(reservationCleanupJob, { pool: second.pool, force: true })
    ).toMatchObject({ status: 'completed', outcome: { deleted: 0 } });

    expect(deleteExpired).toHaveBeenCalledTimes(2);
  });

  it('keeps a stable identity, because a rename or renumber would double-run it', () => {
    expect(reservationCleanupJob.name).toBe('reservation-cleanup');
    expect(reservationCleanupJob.lockId).toBe(JOB_LOCK_IDS.reservationCleanup);
    expect(reservationCleanupJob.intervalMs).toBe(5 * 60 * 1000);
  });

  it('gives every registered job a distinct lock id', () => {
    const ids = Object.values(JOB_LOCK_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('startScheduler', () => {
  it('stops ticking after stop()', async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn(async () => null);
      const fake = fakePool();
      const scheduler = startScheduler({
        jobs: [job(run)],
        tickMs: 1000,
        runOnStart: false,
        pool: fake.pool,
      });

      await vi.advanceTimersByTimeAsync(2500);
      expect(run.mock.calls.length).toBeGreaterThan(0);

      scheduler.stop();
      const before = run.mock.calls.length;
      await vi.advanceTimersByTimeAsync(5000);
      expect(run.mock.calls.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
