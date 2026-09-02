/**
 * Scheduled-job vocabulary.
 *
 * A job is a name, a cadence, an advisory-lock id and a handler that returns a small
 * JSON-serializable outcome. The outcome is what gets written to `scheduled_jobs.last_detail`
 * and logged, so it should say what the run actually did ("deleted 12 rows"), not that it ran.
 */
export interface ScheduledJob<TOutcome = unknown> {
  /** Primary key in `scheduled_jobs`. Stable across deploys — renaming resets the cadence. */
  readonly name: string;
  /** Minimum spacing between two runs across the whole fleet, in milliseconds. */
  readonly intervalMs: number;
  /**
   * Second half of the advisory-lock pair (the first half is a fixed namespace).
   * Must be unique per job and stable — it is an identity, not a counter.
   */
  readonly lockId: number;
  /** Does the work. Throwing marks the run failed; the next interval retries it. */
  run(): Promise<TOutcome>;
}

export type JobRunStatus =
  /** This process claimed the slot and the handler returned. */
  | 'completed'
  /** Another process is running this job right now. */
  | 'skipped-locked'
  /** The job already ran inside the current interval, here or on another instance. */
  | 'skipped-not-due'
  /** This process claimed the slot and the handler threw. */
  | 'failed';

export interface JobRunResult<TOutcome = unknown> {
  readonly job: string;
  readonly status: JobRunStatus;
  readonly durationMs: number;
  readonly outcome?: TOutcome;
  readonly error?: string;
}
