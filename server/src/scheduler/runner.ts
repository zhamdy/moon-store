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
  WITH prior AS (
    SELECT name, last_status FROM scheduled_jobs WHERE name = $1
  ), claim AS (
    INSERT INTO scheduled_jobs (name, last_started_at, last_status, run_count)
    VALUES ($1, NOW(), 'running', 1)
    ON CONFLICT (name) DO UPDATE
      SET last_started_at = NOW(),
          last_status = 'running',
          run_count = scheduled_jobs.run_count + 1
      WHERE scheduled_jobs.last_started_at IS NULL
         OR scheduled_jobs.last_started_at <= NOW() - make_interval(secs => $2)
         OR (scheduled_jobs.last_status = 'running'
             AND scheduled_jobs.last_started_at <= NOW() - make_interval(secs => $3))
    RETURNING name
  )
  SELECT claim.name, COALESCE(prior.last_status = 'running', false) AS took_over
    FROM claim LEFT JOIN prior ON prior.name = claim.name
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

/**
 * How long a claim may sit in `running` before another instance may take it over.
 *
 * Only consulted when the advisory lock is FREE, which is the whole safety argument: a run
 * that is genuinely in progress holds the lock, so a takeover attempt never reaches the
 * claim. A `running` row with no lock behind it therefore means the runner is gone — killed
 * by a deploy, OOM, or the 10s force-exit in `index.ts` — and the row is stale by
 * definition. The threshold only has to be long enough that a lock briefly unheld (the gap
 * between claim and lock does not exist, but be generous) is not mistaken for a death.
 */
export const DEFAULT_STALE_CLAIM_MS = 10 * 60 * 1000;

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

  let unlockError: Error | undefined;

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
      const staleAfterSecs = (job.staleAfterMs ?? DEFAULT_STALE_CLAIM_MS) / 1000;
      const claim = await client.query<{ took_over: boolean }>(CLAIM_SQL, [
        job.name,
        options.force ? 0 : job.intervalMs / 1000,
        options.force ? 0 : staleAfterSecs,
      ]);
      if ((claim.rowCount ?? 0) === 0) {
        return { job: job.name, status: 'skipped-not-due', durationMs: since() };
      }
      if (claim.rows[0]?.took_over && !options.force) {
        // Worth saying out loud: it means a previous run died without recording anything.
        logger.warn('Scheduled job took over a stale claim', { job: job.name });
      }

      let outcome: T;
      try {
        outcome = await job.run();
      } catch (err) {
        const message = (err as Error).message;
        await client.query(RECORD_SQL, [job.name, 'failed', detailOf(message), 1]).catch(() => {});
        logger.error('Scheduled job failed', { job: job.name, error: message });
        return { job: job.name, status: 'failed', durationMs: since(), error: message };
      }

      // The work is done and committed. A ledger write that fails from here on is a
      // bookkeeping problem, not a failed job, and reporting it as a failure would call
      // for a retry of work that already succeeded.
      try {
        await client.query(RECORD_SQL, [job.name, 'success', detailOf(outcome), 0]);
      } catch (err) {
        logger.error('Scheduled job completed but its outcome could not be recorded', {
          job: job.name,
          error: (err as Error).message,
          outcome,
        });
      }

      logger.info('Scheduled job completed', { job: job.name, durationMs: since(), outcome });
      return { job: job.name, status: 'completed', durationMs: since(), outcome };
    } finally {
      // Releasing on every path is what makes a failed run retryable rather than a
      // permanently wedged job.
      await client
        .query('SELECT pg_advisory_unlock($1, $2)', [ADVISORY_LOCK_NAMESPACE, job.lockId])
        .catch((err: Error) => {
          unlockError = err;
          logger.error('Scheduled job could not release its lock', {
            job: job.name,
            error: err.message,
          });
        });
    }
  } catch (err) {
    const message = (err as Error).message;
    logger.error('Scheduled job aborted', { job: job.name, error: message });
    return { job: job.name, status: 'failed', durationMs: since(), error: message };
  } finally {
    // A session whose advisory lock may still be held must not go back into the pool: the
    // next borrower would inherit the lock, every instance would read `skipped-locked`
    // fleet-wide, and a re-entrant re-acquisition would need more unlocks than anyone is
    // going to issue. Passing the error destroys the connection instead.
    client.release(unlockError);
  }
}
