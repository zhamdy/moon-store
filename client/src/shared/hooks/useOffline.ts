import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTransport } from '../lib/transport/index';
import { ApiError } from '../lib/transport/types';
import { useOfflineStore, isQuarantined } from '../store/offlineStore';
import { t } from '../i18n/index';

/** Stable code the server returns when a split-tender sum no longer matches
 * the authoritative amount due (see server/src/modules/pos/sales/types.ts
 * `SPLIT_PAYMENT_MISMATCH_CODE`). Catalog prices, tax, or coupon/loyalty
 * settings can change while a sale sits queued offline, so a previously
 * balanced split can go stale by the time it replays. */
const SPLIT_PAYMENT_MISMATCH_CODE = 'SPLIT_PAYMENT_MISMATCH';

interface UseOfflineReturn {
  isOnline: boolean;
  syncQueue: () => Promise<void>;
  queueLength: number;
  /** Legacy unversioned queued sales awaiting manual cashier review -- never auto-replayed. */
  quarantinedCount: number;
}

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { queue, removeFromQueue, setSyncing, isSyncing } = useOfflineStore();
  // Taken here, at the top of the hook, so the replay below runs on the same
  // transport CartPanel posted the sale on. The replay itself happens in a
  // callback long after render, but the transport it closes over is stable for
  // the life of the component, so nothing has to reach for it at call time.
  const transport = useTransport();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success(t('offline.backOnline'));
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error(t('offline.youAreOffline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing || queue.length === 0) return;

    setSyncing(true);
    let synced = 0;
    let mismatched = 0;

    for (const item of queue) {
      // Quarantined legacy sales are never auto-submitted -- they stay in the
      // queue for manual review, and skipping them here does not block any
      // other (non-sale, or current-contract) entry in a mixed queue.
      if (isQuarantined(item)) continue;

      try {
        if (item.type === 'sale') {
          // The queued payload goes up untouched — it is the body the till
          // already composed, and a replay that reshaped it would post a
          // different sale than the one the cashier rang up. The server
          // still independently prices every line and validates any split
          // against its own authoritative total (Units 2/4), so this is the
          // "revalidates against the current authoritative total before
          // submission" the plan calls for -- the check happens server-side,
          // not by recomputing the total here first.
          await transport.request({ method: 'POST', path: 'sales', body: item.payload });
          removeFromQueue(item.id);
          synced++;
        }
      } catch (err) {
        const isSplitMismatch =
          err instanceof ApiError &&
          err.details?.some((d) => d.code === SPLIT_PAYMENT_MISMATCH_CODE);
        if (isSplitMismatch) {
          // Something changed since this sale was queued (catalog price, tax,
          // coupon/loyalty settings) and its split no longer balances. Leave
          // it queued for a cashier to review and rebalance/re-ring -- do not
          // keep silently retrying it every sync, and do not drop it.
          mismatched++;
        }
        // Any other failure (still offline, server error): keep in queue and
        // retry on the next sync.
      }
    }

    setSyncing(false);
    if (synced > 0) {
      toast.success(t('offline.synced', { count: synced }));
    }
    if (mismatched > 0) {
      toast.error(t('offline.splitMismatch', { count: mismatched }));
    }
  }, [isOnline, isSyncing, queue, removeFromQueue, setSyncing, transport]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
  }, [isOnline, queue.length, syncQueue]);

  return {
    isOnline,
    syncQueue,
    queueLength: queue.length,
    quarantinedCount: queue.filter(isQuarantined).length,
  };
}
