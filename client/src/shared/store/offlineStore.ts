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
}

export interface OfflineQueueItem extends OfflineAction {
  id: number;
  createdAt: string;
}

/**
 * A legacy, unversioned 'sale' entry is quarantined: it is never
 * auto-replayed, because doing so could silently charge the wrong amount
 * (e.g. a `tip` field that was actually a mislabeled Quick Discount under
 * the old UI bug -- see docs/plans/2026-08-30-001-fix-pos-checkout-total-
 * parity-plan.md, "Key Technical Decisions"). It remains visible in the
 * queue for a cashier to review and manually resolve (re-ring the sale, or
 * discard it) rather than being dropped. Non-'sale' entries and any 'sale'
 * entry stamped with the current contract version are never quarantined.
 */
export function isQuarantined(item: OfflineAction): boolean {
  return item.type === 'sale' && !item.contractVersion;
}

interface OfflineState {
  queue: OfflineQueueItem[];
  isSyncing: boolean;
  addToQueue: (action: OfflineAction) => void;
  removeFromQueue: (id: number) => void;
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
