/**
 * In-process tick, fleet-wide single execution.
 *
 * Every API instance ticks on its own timer, exactly as the old `setInterval` did — what
 * changed is that a tick no longer means "do the work". It means "offer to do the work":
 * `runScheduledJob` claims the slot in `scheduled_jobs` and holds an advisory lock, so
 * across N instances the work happens once per interval. See `runner.ts` and migration
 * 007 for why the claim is a single conditional upsert.
 *
 * This is deliberately not a job framework. The whole requirement is "one instance does
 * this every five minutes, and says what it did"; PostgreSQL is already a required
 * dependency and already provides the two primitives that need. Adding Redis, a queue, or
 * an external scheduler would add an operational component to run, monitor and fail over,
 * for maintenance that is a single DELETE.
 */
import type { Pool } from 'pg';
import logger from '../../lib/logger';
import { orphanedMediaCleanupJob, reservationCleanupJob } from './jobs';
import { runScheduledJob } from './runner';
import type { ScheduledJob } from './types';

export * from './types';
export { runScheduledJob, ADVISORY_LOCK_NAMESPACE } from './runner';
export { reservationCleanupJob, orphanedMediaCleanupJob, JOB_LOCK_IDS } from './jobs';
export { sweepOrphanedMedia, type SweepOutcome } from './mediaSweep';

/**
 * How often an instance offers to run due jobs. Shorter than the shortest job interval so
 * a job's real cadence is set by its own `intervalMs`, not by the tick.
 */
export const DEFAULT_TICK_MS = 60 * 1000;

export const defaultJobs: ScheduledJob<unknown>[] = [
  reservationCleanupJob,
  orphanedMediaCleanupJob,
];

export interface Scheduler {
  /** Runs one pass over the job list. Exposed for tests and for a manual trigger. */
  tick(): Promise<void>;
  stop(): void;
}

export interface StartSchedulerOptions {
  jobs?: ScheduledJob<unknown>[];
  tickMs?: number;
  /** Run a pass immediately on start, so a fresh deploy does not wait a full tick. */
  runOnStart?: boolean;
  /** Pool the jobs claim through. Defaults to the application pool. */
  pool?: Pool;
}

export function startScheduler(options: StartSchedulerOptions = {}): Scheduler {
  const jobs = options.jobs ?? defaultJobs;
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;

  async function tick(): Promise<void> {
    for (const job of jobs) {
      // runScheduledJob never throws; this catch is for the impossible case only.
      await runScheduledJob(job, { pool: options.pool }).catch((err: Error) =>
        logger.error('Scheduler tick failed', { job: job.name, error: err.message })
      );
    }
  }

  const handle = setInterval(() => void tick(), tickMs);

  if (options.runOnStart !== false) {
    void tick();
  }

  logger.info('Scheduler started', { jobs: jobs.map((j) => j.name), tickMs });

  return {
    tick,
    stop() {
      clearInterval(handle);
    },
  };
}
