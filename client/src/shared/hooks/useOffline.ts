import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTransport } from '../lib/transport/index';
import {
  useOfflineStore,
  isQuarantined,
  isEligible,
  earliestAttemptAt,
} from '../store/offlineStore';
import { t } from '../i18n/index';
import { classifyFailure, FAILURE_REASON } from '../lib/offlineRetry';

interface UseOfflineReturn {
  isOnline: boolean;
  syncQueue: () => Promise<void>;
  queueLength: number;
  /** Legacy unversioned or split-mismatched queued sales -- never auto-replayed. */
  quarantinedCount: number;
  /** Sales parked after a failed replay, awaiting an explicit cashier Retry. */
  failedCount: number;
  /** Puts every parked sale back in play; the scheduler picks it up from there. */
  retryFailed: () => void;
}

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Narrow, scalar subscriptions on purpose. Destructuring the whole store
  // re-rendered this hook -- and Layout beneath it, which wraps every
  // authenticated page -- on every unrelated `set()`, including the two
  // `setSyncing` calls each sweep makes.
  const queueLength = useOfflineStore((state) => state.queue.length);
  const quarantinedCount = useOfflineStore((state) => state.queue.filter(isQuarantined).length);
  const failedCount = useOfflineStore(
    (state) => state.queue.filter((item) => item.syncFailed === true).length
  );
  // The single scalar that drives auto-sync: when the queue next wants a
  // sweep, or null when it never will on its own.
  const nextAttemptAt = useOfflineStore((state) => earliestAttemptAt(state.queue));
  // Taken here, at the top of the hook, so the replay below runs on the same
  // transport CartPanel posted the sale on. The replay itself happens in a
  // callback long after render, but the transport it closes over is stable for
  // the life of the component, so nothing has to reach for it at call time.
  const transport = useTransport();
  // Guards re-entry within this session. Deliberately not the store's
  // `isSyncing`, which is a UI indicator and used to deadlock the queue when a
  // killed tab persisted it as true.
  const inFlight = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // A backoff computed against a dead link says nothing about a live one,
      // so reconnecting retries at once. Attempts are untouched, so a poison
      // entry still parks on schedule.
      useOfflineStore.getState().clearBackoff();
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

  // syncQueue re-invokes itself at the end of a sweep; a ref keeps that from
  // making the callback depend on its own identity.
  const syncQueueRef = useRef<() => Promise<void>>(async () => {});

  const syncQueue = useCallback(async () => {
    if (!isOnline || inFlight.current) return;

    // Read at call time rather than closing over the queue: a callback whose
    // identity changes on every store write is what drove the old effect to
    // re-fire without pause after a failed replay.
    const { queue, removeFromQueue, markMismatched, recordFailure, setSyncing } =
      useOfflineStore.getState();
    const now = Date.now();
    const due = queue.filter((item) => isEligible(item, now));
    // Nothing to do -- and nothing written, so no re-render and no churn. A
    // queue holding only quarantined, parked or backing-off entries lands here.
    if (due.length === 0) return;

    inFlight.current = true;
    setSyncing(true);
    let synced = 0;
    let mismatched = 0;

    try {
      for (const item of due) {
        try {
          // The queued payload goes up untouched — it is the body the till
          // already composed, and a replay that reshaped it would post a
          // different sale than the one the cashier rang up. The server
          // still independently prices every line and validates any split
          // against its own authoritative total.
          await transport.request({
            method: 'POST',
            path: 'sales',
            body: item.payload,
            // Omitted entirely for an entry queued before keys existed, so it
            // replays exactly as it did before rather than under a key the
            // server never saw.
            ...(item.idempotencyKey ? { idempotencyKey: item.idempotencyKey } : {}),
          });
          removeFromQueue(item.id);
          synced++;
        } catch (err) {
          const outcome = classifyFailure(err);
          if (outcome.reason === FAILURE_REASON.splitMismatch) {
            // Something changed since this sale was queued (catalog price, tax,
            // coupon/loyalty settings) and its split no longer balances. It
            // keeps its own quarantine state rather than also being counted as
            // a sync failure -- the cashier sees one problem, not two.
            markMismatched(item.id);
            mismatched++;
          } else {
            recordFailure(item.id, outcome);
          }
        }
      }
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }

    if (synced > 0) {
      toast.success(t('offline.synced', { count: synced }));
    }
    if (mismatched > 0) {
      toast.error(t('offline.splitMismatch', { count: mismatched }));
    }

    // A sale rung up while this sweep was running was not in `due` and cannot
    // move the scheduler's scalar (it is already zero), so it would otherwise
    // sit until something else woke the queue. This terminates: every sweep
    // leaves each entry it touched removed, parked, or scheduled into the
    // future, so only genuinely new work re-enters here.
    if (useOfflineStore.getState().queue.some((item) => isEligible(item))) {
      void syncQueueRef.current();
    }
  }, [isOnline, transport]);

  syncQueueRef.current = syncQueue;

  // Auto-sync, driven by when the queue is next due rather than by callback
  // identity. Nothing due ever => no timer at all.
  useEffect(() => {
    if (!isOnline || nextAttemptAt === null) return;

    const delay = nextAttemptAt - Date.now();
    if (delay <= 0) {
      void syncQueue();
      return;
    }

    const timer = setTimeout(() => void syncQueue(), delay);
    return () => clearTimeout(timer);
  }, [isOnline, nextAttemptAt, syncQueue]);

  const retryFailed = useCallback(() => {
    useOfflineStore.getState().clearRetryState();
  }, []);

  return {
    isOnline,
    syncQueue,
    queueLength,
    quarantinedCount,
    failedCount,
    retryFailed,
  };
}
