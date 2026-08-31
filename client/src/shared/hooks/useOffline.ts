import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTransport } from '../lib/transport/index';
import { ApiError } from '../lib/transport/types';
import {
  useOfflineStore,
  isQuarantined,
  isParked,
  isEligible,
  earliestAttemptAt,
} from '../store/offlineStore';
import { t } from '../i18n/index';
import { classifyFailure, FAILURE_REASON, RETRY_CEILING_MS } from '../lib/offlineRetry';

/**
 * Guards a sweep against re-entry. Module-scoped, not a ref, because the queue
 * it protects is a single global store: two mounted consumers would otherwise
 * each hold their own guard and post the same sale twice. (The shared
 * `Idempotency-Key` means the server would still commit it once -- this keeps
 * the till from making the request at all.)
 *
 * Deliberately not the store's `isSyncing`, which is a UI indicator and used
 * to deadlock the queue when a killed tab persisted it as true.
 */
let sweepInFlight = false;

/**
 * Test-only. Both module-scoped values outlive any component, and vitest
 * isolates the module registry per file rather than per test -- so a stranded
 * guard would silently no-op every later sweep, and a stale reconnect stamp
 * would silently swallow the next `online` event.
 */
export function resetOfflineSchedulerForTests(): void {
  sweepInFlight = false;
  lastReconnectRetryAt = 0;
}

/**
 * A replay that never settles used to hold `sweepInFlight` forever, and the
 * axios instance sets no timeout -- so a black-holed connection (a captive
 * portal on shop wifi, a half-open socket after an access-point handover)
 * silently killed the queue for the life of the tab. The old busy loop was
 * accidentally its own recovery path; removing the loop removed that, so the
 * deadline has to be explicit.
 *
 * The underlying request is not cancelled, only abandoned. That is safe: it
 * carries the same `Idempotency-Key`, so if it does land the retry collapses
 * onto the original outcome instead of charging twice.
 */
const REPLAY_TIMEOUT_MS = 30_000;

/**
 * The shortest gap between two reconnect-driven retries. Without it a flapping
 * link burns the whole attempt budget in seconds: every `online` event pulls
 * every entry forward, each sweep fails, and ten flaps park a sale that a
 * budget sized for a 40-minute outage was meant to carry through.
 */
const RECONNECT_RETRY_THROTTLE_MS = 60_000;

let lastReconnectRetryAt = 0;

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      // A null status is the shape http.ts produces for "never reached the
      // server", which is exactly what this is, and classifies as retryable.
      () => reject(new ApiError('', null)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

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
  // Bumped when a scheduled wake-up lands, so the scheduler effect re-measures
  // the wait instead of trusting a delay it may have clamped.
  const [schedulerTick, setSchedulerTick] = useState(0);
  // Narrow, scalar subscriptions on purpose. Destructuring the whole store
  // re-rendered this hook -- and Layout beneath it, which wraps every
  // authenticated page -- on every unrelated `set()`, including the two
  // `setSyncing` calls each sweep makes.
  const queueLength = useOfflineStore((state) => state.queue.length);
  const quarantinedCount = useOfflineStore((state) => state.queue.filter(isQuarantined).length);
  const failedCount = useOfflineStore((state) => state.queue.filter(isParked).length);
  // The single scalar that drives auto-sync: when the queue next wants a
  // sweep, or null when it never will on its own.
  const nextAttemptAt = useOfflineStore((state) => earliestAttemptAt(state.queue));
  // Taken here, at the top of the hook, so the replay below runs on the same
  // transport CartPanel posted the sale on. The replay itself happens in a
  // callback long after render, but the transport it closes over is stable for
  // the life of the component, so nothing has to reach for it at call time.
  const transport = useTransport();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // A backoff computed against a dead link says nothing about a live one,
      // so reconnecting pulls the queue forward -- but throttled, because
      // attempts are spent per event, not per elapsed minute, and a flapping
      // link would otherwise park perfectly healthy sales.
      const now = Date.now();
      if (now - lastReconnectRetryAt >= RECONNECT_RETRY_THROTTLE_MS) {
        lastReconnectRetryAt = now;
        useOfflineStore.getState().retrySoon();
      }
      toast.success(t('offline.backOnline'));
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error(t('offline.youAreOffline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // `navigator.onLine` was sampled during render, before these listeners
    // existed. A transition in that window would otherwise be lost for the
    // life of the session, leaving the scheduler permanently short-circuited.
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // syncQueue re-invokes itself at the end of a sweep; a ref keeps that from
  // making the callback depend on its own identity.
  const syncQueueRef = useRef<() => Promise<void>>(async () => {});

  const syncQueue = useCallback(async () => {
    if (!isOnline || sweepInFlight) return;

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

    sweepInFlight = true;
    let synced = 0;
    let mismatched = 0;

    try {
      // Inside the try: zustand's persist wrapper rethrows a storage failure
      // (a full or disabled localStorage) straight out of `set`, and raising
      // the guard without a matching release would strand the queue for good.
      setSyncing(true);

      for (const item of due) {
        try {
          // The queued payload goes up untouched — it is the body the till
          // already composed, and a replay that reshaped it would post a
          // different sale than the one the cashier rang up. The server
          // still independently prices every line and validates any split
          // against its own authoritative total.
          await withDeadline(
            transport.request({
              method: 'POST',
              path: 'sales',
              body: item.payload,
              // Omitted entirely for an entry queued before keys existed, so it
              // replays exactly as it did before rather than under a key the
              // server never saw.
              ...(item.idempotencyKey ? { idempotencyKey: item.idempotencyKey } : {}),
            }),
            REPLAY_TIMEOUT_MS
          );
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
          } else if (outcome.retryable && !item.idempotencyKey) {
            // The retry budget is only safe because a replay carries a key the
            // server can collapse onto one sale. This entry predates keys, so
            // every retry is an unguarded financial write: if the original POST
            // committed and only the response was lost, retrying rings the sale
            // up again. Park it on the first failure and let a human decide.
            recordFailure(item.id, { retryable: false, reason: FAILURE_REASON.unguardedReplay });
          } else {
            recordFailure(item.id, outcome);
          }
        }
      }
    } finally {
      sweepInFlight = false;
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

  // Assigned in an effect, not during render: a render can be started and
  // discarded, and a discarded render must not publish a callback closing over
  // connectivity state the committed tree disagrees with.
  useEffect(() => {
    syncQueueRef.current = syncQueue;
  }, [syncQueue]);

  // Auto-sync, driven by when the queue is next due rather than by callback
  // identity. Nothing due ever => no timer at all.
  useEffect(() => {
    if (!isOnline || nextAttemptAt === null) return;

    // Clamped because `nextAttemptAt` is an absolute wall-clock instant: a
    // clock correction can put it arbitrarily far out, and past the int32
    // timer limit setTimeout fires immediately instead of waiting.
    const delay = Math.min(Math.max(nextAttemptAt - Date.now(), 0), RETRY_CEILING_MS);
    if (delay === 0) {
      void syncQueue();
      return;
    }

    // The timer advances a tick rather than sweeping directly. A clamped delay
    // can expire before the entry is actually due, and a blind sweep would
    // then do nothing, write nothing, leave every dependency unchanged and
    // wedge the queue -- whereas a tick re-runs this effect, which re-measures
    // against the current clock and arms the next slice.
    const timer = setTimeout(() => setSchedulerTick((tick) => tick + 1), delay);
    return () => clearTimeout(timer);
  }, [isOnline, nextAttemptAt, syncQueue, schedulerTick]);

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
