import { reservationsRepository } from '../modules/pos/reservations/repository';
import type { ScheduledJob } from './types';

/**
 * Lock ids are identities, not indexes. Never renumber an existing one — during a rolling
 * deploy the old and new code run side by side, and two ids for one job means two
 * concurrent runs.
 */
export const JOB_LOCK_IDS = {
  reservationCleanup: 1,
  orphanedMediaCleanup: 2,
} as const;

/**
 * Deletes stock reservations whose hold has expired.
 *
 * Idempotent by construction: the DELETE is keyed on `expires_at <= NOW()`, so a retry
 * after a partial failure removes whatever is still expired and reports `{ deleted: 0 }`
 * when there is nothing left. Reporting the count is the point — a silent `void` cleanup
 * is indistinguishable from one that never ran.
 */
export const reservationCleanupJob: ScheduledJob<{ deleted: number }> = {
  name: 'reservation-cleanup',
  intervalMs: 5 * 60 * 1000,
  lockId: JOB_LOCK_IDS.reservationCleanup,
  async run() {
    const deleted = await reservationsRepository.deleteExpired();
    return { deleted };
  },
};
