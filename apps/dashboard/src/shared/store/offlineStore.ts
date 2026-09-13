import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OFFLINE_QUEUE_STORAGE_KEY } from '@/shared/lib/storageKeys';
import { createIdempotencyKey } from '@/shared/lib/transport/idempotency';
import {
  jitter,
  nextAttemptDelay,
  MAX_RETRYABLE_ATTEMPTS,
  RETRY_BASE_MS,
  type FailureOutcome,
} from '@/shared/lib/offlineRetry';

/**
 * A queue entry's identity. Entries minted since collision-free ids shipped
 * carry an opaque string; entries persisted before that carry the `Date.now()`
 * number they were given.
 *
 * Widening the type is not on its own enough. A numeric id still *matches*
 * under the `===`/`!==` lookups below, but two pre-upgrade entries rung up in
 * the same millisecond still share one -- which is the whole defect, surviving
 * in exactly the population that already has queued money. `migrateQueueIds`
 * on rehydrate is what actually closes it; the union type is here so entries
 * are addressable in the window before that runs.
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
  return isQuarantined(item) || isParked(item);
}

/** Parked after a failed replay -- see `syncFailed`. Never auto-replayed. */
export function isParked(item: OfflineAction): boolean {
  return item.syncFailed === true;
}

/**
 * The instant an entry may next be replayed, as epoch ms. No `nextAttemptAt`
 * means due now -- and so does an unparseable one: a corrupt `localStorage`
 * value must make the entry retry, not vanish from every code path that could
 * ever surface it (`NaN` compares false against everything).
 */
function attemptAt(item: OfflineAction): number {
  if (!item.nextAttemptAt) return 0;
  const parsed = Date.parse(item.nextAttemptAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Whether an entry's backoff has elapsed. No `nextAttemptAt` means due now. */
export function isDue(item: OfflineAction, now: number = Date.now()): boolean {
  return attemptAt(item) <= now;
}

/**
 * `sale` is the only type anything enqueues, and the only type useOffline
 * knows how to replay. Anything else is inert -- it must not be counted as
 * work waiting to happen, or the scheduler would arm a timer for a sweep that
 * can never do anything.
 */
function isReplayable(item: OfflineAction): boolean {
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
    const at = attemptAt(item);
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
   * Pulls every pending backoff in to a short jittered delay on reconnect,
   * without forgiving any attempts -- so a network change retries promptly
   * while a poison entry still parks on schedule.
   *
   * Deliberately not "due immediately": every till in the shop gets the same
   * `online` event, and setting them all to zero restores exactly the lockstep
   * stampede the jitter exists to break.
   */
  retrySoon: () => void;
  clearQueue: () => void;
  setSyncing: (isSyncing: boolean) => void;
  getQueueLength: () => number;
  /** Legacy unversioned 'sale' entries awaiting manual cashier review -- see `isQuarantined`. */
  getQuarantinedCount: () => number;
}

/**
 * Replaces every legacy `Date.now()` id with a collision-free one, in place,
 * on rehydrate.
 *
 * Widening the id type made old entries addressable but left them colliding:
 * two sales rung up in the same millisecond before the upgrade still share an
 * id, so removing one drops both and `recordFailure` on one charges attempts
 * to the other. Ids are internal to this store -- nothing persists or
 * transmits them -- so restamping is safe, and it is the only thing that makes
 * R5 true for the tills that already have queued money.
 */
export function migrateQueueIds(queue: OfflineQueueItem[]): OfflineQueueItem[] {
  return queue.map((item) =>
    typeof item.id === 'number' ? { ...item, id: createQueueItemId() } : item
  );
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

      retrySoon: () =>
        set((state) => {
          const now = Date.now();
          return {
            queue: state.queue.map((item) => {
              if (attemptAt(item) <= now) return item;
              return {
                ...item,
                nextAttemptAt: new Date(now + jitter(RETRY_BASE_MS)).toISOString(),
              };
            }),
          };
        }),

      clearQueue: () => set({ queue: [] }),

      setSyncing: (isSyncing) => set({ isSyncing }),

      getQueueLength: () => get().queue.length,

      getQuarantinedCount: () => get().queue.filter(isQuarantined).length,
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
        if (!state) return;
        state.isSyncing = false;
        state.queue = migrateQueueIds(state.queue);
      },
    }
  )
);
