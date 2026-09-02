import type { Pool, PoolClient } from 'pg';
import logger from '../../lib/logger';
import { getPool } from '../database/pool';
import type { JobRunResult, ScheduledJob } from './types';

/**
 * First half of every advisory-lock pair this app takes ("MOON" as an int32). Keeps the
 * scheduler's key space from colliding with any other advisory lock in the database.
 */
export const ADVISORY_LOCK_NAMESPACE = 0x4d4f4f4e;

/**
 * The claim. One statement decides whether this process runs the job, for the same
 * reason a stock decrement is one statement: a read-then-write would let two instances
 * both observe "due" and both run.
 *
 * `make_interval(secs => $2)` keeps the due-window arithmetic on the database clock.
 * Comparing a stored timestamp against a locally computed instant would make the cadence
 * depend on each instance's clock skew.
 */
const CLAIM_SQL = `
  INSERT INTO scheduled_jobs (name, last_started_at, last_status, run_count)
  VALUES ($1, NOW(), 'running', 1)
  ON CONFLICT (name) DO UPDATE
    SET last_started_at = NOW(),
        last_status = 'running',
        run_count = scheduled_jobs.run_count + 1
    WHERE scheduled_jobs.last_started_at IS NULL
       OR scheduled_jobs.last_started_at <= NOW() - make_interval(secs => $2)
  RETURNING name
`;

const RECORD_SQL = `
  UPDATE scheduled_jobs
     SET last_finished_at = NOW(),
         last_status = $2,
         last_detail = $3,
         failure_count = scheduled_jobs.failure_count + $4
   WHERE name = $1
`;

/** Truncated so a pathological outcome cannot bloat the row. */
function detailOf(value: unknown): string {
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  } catch {
    text = String(value);
  }
  return (text ?? 'null').slice(0, 1000);
}

export interface RunScheduledJobOptions {
  /** Pool to claim through. Defaults to the application pool. */
  pool?: Pool;
  /**
   * Ignore the due window and run as long as the advisory lock is free. For an operator
   * triggering a run by hand; the scheduler never sets it.
   */
  force?: boolean;
}

/**
 * Runs one job at most once across the whole fleet per interval.
 *
 * Two guards, in order:
 *  1. a session-level advisory lock held for the duration of the run, so two runs cannot
 *     overlap even if the handler outlives its own interval;
 *  2. the conditional claim in `scheduled_jobs`, so a second instance waking a second
 *     later inside the same window does not repeat work the first already did.
 *
 * Never throws: a maintenance failure must not take down the tick that schedules it. The
 * outcome comes back as a value and is written to the ledger and the log.
 */
export async function runScheduledJob<T>(
  job: ScheduledJob<T>,
  options: RunScheduledJobOptions = {}
): Promise<JobRunResult<T>> {
  const pool = options.pool ?? getPool();
  const startedAt = Date.now();
  const since = () => Date.now() - startedAt;

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (err) {
    const message = (err as Error).message;
    logger.error('Scheduled job could not reach the database', { job: job.name, error: message });
    return { job: job.name, status: 'failed', durationMs: since(), error: message };
  }

  try {
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      [ADVISORY_LOCK_NAMESPACE, job.lockId]
    );
    if (!lock.rows[0]?.locked) {
      logger.debug('Scheduled job already running elsewhere', { job: job.name });
      return { job: job.name, status: 'skipped-locked', durationMs: since() };
    }

    try {
      if (!options.force) {
        const claim = await client.query(CLAIM_SQL, [job.name, job.intervalMs / 1000]);
        if ((claim.rowCount ?? 0) === 0) {
          return { job: job.name, status: 'skipped-not-due', durationMs: since() };
        }
      } else {
        await client.query(CLAIM_SQL, [job.name, 0]);
      }

      try {
        const outcome = await job.run();
        await client.query(RECORD_SQL, [job.name, 'success', detailOf(outcome), 0]);
        logger.info('Scheduled job completed', {
          job: job.name,
          durationMs: since(),
          outcome,
        });
        return { job: job.name, status: 'completed', durationMs: since(), outcome };
      } catch (err) {
        const message = (err as Error).message;
        await client.query(RECORD_SQL, [job.name, 'failed', detailOf(message), 1]).catch(() => {});
        logger.error('Scheduled job failed', { job: job.name, error: message });
        return { job: job.name, status: 'failed', durationMs: since(), error: message };
      }
    } finally {
      // Releasing on every path is what makes a failed run retryable rather than a
      // permanently wedged job.
      await client
        .query('SELECT pg_advisory_unlock($1, $2)', [ADVISORY_LOCK_NAMESPACE, job.lockId])
        .catch((err: Error) =>
          logger.error('Scheduled job could not release its lock', {
            job: job.name,
            error: err.message,
          })
        );
    }
  } catch (err) {
    const message = (err as Error).message;
    logger.error('Scheduled job aborted', { job: job.name, error: message });
    return { job: job.name, status: 'failed', durationMs: since(), error: message };
  } finally {
    client.release();
  }
}
