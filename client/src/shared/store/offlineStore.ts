import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OFFLINE_QUEUE_STORAGE_KEY } from '@/shared/lib/storageKeys';
import { createIdempotencyKey } from '@/shared/lib/transport/idempotency';

/**
 * A queue entry's identity. Entries minted since collision-free ids shipped
 * carry an opaque string; entries already in a cashier's `localStorage` from
 * before carry the `Date.now()` number they were given. Both keep matching
 * under the `===`/`!==` lookups below, so no rehydrate migration is needed.
 */
export type OfflineQueueItemId = string | number;

/**
 * Deliberately the same generator as the `Idempotency-Key`, and deliberately
 * a different name: a queue id identifies a row in this device's queue, a key
 * identifies a mutation to the server. Reusing the generator inherits its
 * documented non-secure-context fallback, which a till served over plain HTTP
 * on a shop LAN actually needs -- and `Date.now()` alone collides whenever two
 * sales are rung up in the same millisecond, at which point syncing one
 * silently deletes the other.
 */
export function createQueueItemId(): OfflineQueueItemId {
  return createIdempotencyKey();
}

/**
 * Sale-payload contract version stamped onto every NEW `type: 'sale'` queue
 * entry (see CartPanel.tsx's offline fallback and useOffline.ts). A queued
 * sale WITHOUT this field predates the checkout total-parity fix (Units 1-4)
 * and may have been composed under the old, incorrect tip/loyalty formula --
 * it is not safe to assume its `tip`/discount fields mean what the current
 * formula would compute from them. See `isQuarantined` below.
 */
export const SALE_QUEUE_CONTRACT_VERSION = 'v1';

export interface OfflineAction {
  type: string;
  payload: Record<string, unknown>;
  /** Present on any 'sale' entry queued under the current checkout contract. */
  contractVersion?: string;
  /**
   * The `Idempotency-Key` the checkout attempt was stamped with, replayed
   * verbatim by useOffline.ts so a sale that reaches the server twice (queued
   * offline, then also delivered by a late-succeeding request) is committed
   * once. Optional: entries persisted before this shipped carry no key and
   * replay keyless, exactly as they did before.
   */
  idempotencyKey?: string;
  /**
   * Set once a sync attempt is rejected with SPLIT_PAYMENT_MISMATCH: the
   * catalog/tax/coupon/loyalty state changed since this sale was queued and
   * its split no longer balances. A mismatched entry is quarantined the same
   * way an unversioned legacy entry is -- it must not be silently re-posted
   * (and re-fail) on every subsequent sync; a cashier must review/re-ring it.
   */
  mismatched?: boolean;
  /**
   * How many replay attempts this entry has consumed. Absent means zero: an
   * entry persisted before retry state existed is at attempt zero and due
   * immediately, so it replays exactly as it did before.
   */
  attempts?: number;
  /**
   * Earliest instant (ISO, matching `createdAt`) at which this entry may be
   * replayed again, set from `nextAttemptDelay` after a retryable failure.
   * Absent means due now -- which is also the pre-retry-state shape.
   */
  nextAttemptAt?: string;
  /**
   * Set when the entry is parked: either the failure was deterministic (the
   * server will reject the replay identically however long we wait) or the
   * retryable budget ran out. A parked entry is never auto-replayed and never
   * dropped; only an explicit cashier Retry (`clearRetryState`) revives it.
   * Absent means the entry is still in normal play.
   */
  syncFailed?: boolean;
  /** Short reason for the last failure, for the banner and for support. */
  lastFailure?: string;
}

/** First backoff step. Doubles per consecutive retryable failure. */
export const RETRY_BASE_MS = 1_000;
/** Backoff never grows past this, so a recovered server is retried promptly. */
export const RETRY_CEILING_MS = 5 * 60 * 1_000;
/**
 * Attempts a retryable failure may consume before the entry parks. Sized for
 * roughly 40 minutes of trying -- affordable only because every replay carries
 * the same `Idempotency-Key`, so retrying cannot double-charge. Parking a
 * legitimate sale during a ten-minute server restart would force the cashier
 * to re-ring it, which is the more expensive mistake.
 */
export const MAX_RETRYABLE_ATTEMPTS = 10;
/**
 * Every till in the shop comes back on the same `online` event and would
 * otherwise retry in lockstep against a server that just restarted.
 */
export const RETRY_JITTER = 0.2;

/**
 * Delay before attempt `attempts + 1`, given `attempts` consecutive failures
 * so far. Exported so tests assert the policy rather than a hard-coded ladder.
 */
export function nextAttemptDelay(attempts: number, minDelayMs = 0): number {
  const exponential = RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1);
  const capped = Math.min(Math.max(exponential, minDelayMs), RETRY_CEILING_MS);
  return Math.round(capped * (1 - RETRY_JITTER + Math.random() * 2 * RETRY_JITTER));
}

/** How a failed replay should be recorded -- see `client/src/shared/lib/offlineRetry.ts`. */
export interface FailureOutcome {
  retryable: boolean;
  reason: string;
  /** Floor for the next backoff step, for a failure that says how long to wait. */
  minDelayMs?: number;
}

export interface OfflineQueueItem extends OfflineAction {
  id: OfflineQueueItemId;
  createdAt: string;
}

/**
 * A 'sale' entry is quarantined -- never auto-replayed -- in two cases:
 *
 * 1. Legacy/unversioned: it predates the checkout total-parity fix, so a
 *    `tip` field could actually be a mislabeled Quick Discount under the old
 *    UI bug (see docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-
 *    plan.md, "Key Technical Decisions"), and replaying it could silently
 *    charge the wrong amount.
 * 2. Mismatched: a sync attempt was rejected with SPLIT_PAYMENT_MISMATCH,
 *    meaning catalog/tax/coupon/loyalty state changed since it was queued
 *    and its split no longer balances (see `markMismatched`).
 *
 * Either way the entry remains visible in the queue for a cashier to review
 * and manually resolve (re-ring the sale, or discard it) rather than being
 * dropped or silently retried forever. Non-'sale' entries are never
 * quarantined.
 */
export function isQuarantined(item: OfflineAction): boolean {
  return item.type === 'sale' && (!item.contractVersion || item.mismatched === true);
}

/**
 * An entry a cashier has to deal with by hand: quarantined (legacy or
 * split-mismatched) or parked after a failed replay. Deliberately separate
 * from `isQuarantined`, which keeps its two existing meanings so the comments
 * and tests around it stay true -- a parked entry is not quarantined.
 */
export function needsReview(item: OfflineAction): boolean {
  return isQuarantined(item) || item.syncFailed === true;
}

/** Whether an entry's backoff has elapsed. No `nextAttemptAt` means due now. */
export function isDue(item: OfflineAction, now: number = Date.now()): boolean {
  return !item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= now;
}

/**
 * `sale` is the only type anything enqueues, and the only type useOffline
 * knows how to replay. Anything else is inert -- it must not be counted as
 * work waiting to happen, or the scheduler would arm a timer for a sweep that
 * can never do anything.
 */
export function isReplayable(item: OfflineAction): boolean {
  return item.type === 'sale';
}

/** Whether an entry may be auto-replayed right now. */
export function isEligible(item: OfflineAction, now: number = Date.now()): boolean {
  return isReplayable(item) && !needsReview(item) && isDue(item, now);
}

/**
 * When the queue next wants a sync sweep, as an epoch instant, or null when
 * nothing will ever become due on its own (empty, or every entry needs review).
 * Null is what lets the scheduler arm no timer at all rather than spinning on
 * a queue it can do no work on.
 */
export function earliestAttemptAt(queue: OfflineQueueItem[]): number | null {
  let earliest: number | null = null;
  for (const item of queue) {
    if (!isReplayable(item) || needsReview(item)) continue;
    const at = item.nextAttemptAt ? Date.parse(item.nextAttemptAt) : 0;
    if (earliest === null || at < earliest) earliest = at;
  }
  return earliest;
}

interface OfflineState {
  queue: OfflineQueueItem[];
  isSyncing: boolean;
  addToQueue: (action: OfflineAction) => void;
  removeFromQueue: (id: OfflineQueueItemId) => void;
  /** Flags a queued entry as quarantined after a SPLIT_PAYMENT_MISMATCH rejection. */
  markMismatched: (id: OfflineQueueItemId) => void;
  /**
   * Records one failed replay: counts the attempt, and either schedules the
   * next one or parks the entry (terminal failure, or budget exhausted).
   */
  recordFailure: (id: OfflineQueueItemId, outcome: FailureOutcome) => void;
  /**
   * The cashier's Retry. Clears attempts/backoff/parked state -- and nothing
   * else. `idempotencyKey` is deliberately preserved: if the original attempt
   * did commit server-side, the manual retry replays onto the same key and
   * returns the original outcome instead of charging twice. With no id, revives
   * every parked entry.
   */
  clearRetryState: (id?: OfflineQueueItemId) => void;
  /**
   * Drops pending backoff on reconnect without forgiving any attempts, so a
   * network change retries at once while a poison entry still parks on
   * schedule.
   */
  clearBackoff: () => void;
  clearQueue: () => void;
  setSyncing: (isSyncing: boolean) => void;
  getQueueLength: () => number;
  /** Legacy unversioned 'sale' entries awaiting manual cashier review -- see `isQuarantined`. */
  getQuarantinedCount: () => number;
  /** Entries parked after a failed replay, awaiting an explicit cashier Retry. */
  getFailedCount: () => number;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,

      addToQueue: (action) =>
        set((state) => ({
          queue: [
            ...state.queue,
            { ...action, id: createQueueItemId(), createdAt: new Date().toISOString() },
          ],
        })),

      removeFromQueue: (id) =>
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        })),

      markMismatched: (id) =>
        set((state) => ({
          queue: state.queue.map((item) => (item.id === id ? { ...item, mismatched: true } : item)),
        })),

      recordFailure: (id, { retryable, reason, minDelayMs }) =>
        set((state) => ({
          queue: state.queue.map((item) => {
            if (item.id !== id) return item;
            const attempts = (item.attempts ?? 0) + 1;
            if (!retryable || attempts >= MAX_RETRYABLE_ATTEMPTS) {
              const { nextAttemptAt: _dropped, ...rest } = item;
              return { ...rest, attempts, syncFailed: true, lastFailure: reason };
            }
            return {
              ...item,
              attempts,
              lastFailure: reason,
              nextAttemptAt: new Date(
                Date.now() + nextAttemptDelay(attempts, minDelayMs)
              ).toISOString(),
            };
          }),
        })),

      clearRetryState: (id) =>
        set((state) => ({
          queue: state.queue.map((item) => {
            const target = id === undefined ? item.syncFailed === true : item.id === id;
            if (!target) return item;
            const {
              attempts: _attempts,
              nextAttemptAt: _nextAttemptAt,
              syncFailed: _syncFailed,
              lastFailure: _lastFailure,
              ...rest
            } = item;
            return rest;
          }),
        })),

      clearBackoff: () =>
        set((state) => ({
          queue: state.queue.map((item) => {
            if (!item.nextAttemptAt) return item;
            const { nextAttemptAt: _dropped, ...rest } = item;
            return rest;
          }),
        })),

      clearQueue: () => set({ queue: [] }),

      setSyncing: (isSyncing) => set({ isSyncing }),

      getQueueLength: () => get().queue.length,

      getQuarantinedCount: () => get().queue.filter(isQuarantined).length,

      getFailedCount: () => get().queue.filter((item) => item.syncFailed === true).length,
    }),
    {
      name: OFFLINE_QUEUE_STORAGE_KEY,
      // `isSyncing` describes a sweep happening in THIS tab, so persisting it
      // is meaningless at best. At worst a tab killed mid-sync writes `true`
      // and every later load early-returns out of syncQueue forever, stranding
      // the queue. Partialize keeps new writes clean; the rehydrate reset is
      // what rescues a blob already carrying `true`.
      partialize: (state) => ({ queue: state.queue }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isSyncing = false;
      },
    }
  )
);
