import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OFFLINE_QUEUE_STORAGE_KEY } from '@/shared/lib/storageKeys';

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
}

export interface OfflineQueueItem extends OfflineAction {
  id: number;
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

interface OfflineState {
  queue: OfflineQueueItem[];
  isSyncing: boolean;
  addToQueue: (action: OfflineAction) => void;
  removeFromQueue: (id: number) => void;
  /** Flags a queued entry as quarantined after a SPLIT_PAYMENT_MISMATCH rejection. */
  markMismatched: (id: number) => void;
  clearQueue: () => void;
  setSyncing: (isSyncing: boolean) => void;
  getQueueLength: () => number;
  /** Legacy unversioned 'sale' entries awaiting manual cashier review -- see `isQuarantined`. */
  getQuarantinedCount: () => number;
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
            { ...action, id: Date.now(), createdAt: new Date().toISOString() },
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

      clearQueue: () => set({ queue: [] }),

      setSyncing: (isSyncing) => set({ isSyncing }),

      getQueueLength: () => get().queue.length,

      getQuarantinedCount: () => get().queue.filter(isQuarantined).length,
    }),
    {
      name: OFFLINE_QUEUE_STORAGE_KEY,
    }
  )
);
