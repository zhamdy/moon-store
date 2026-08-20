import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTransport } from '../lib/transport';
import { useOfflineStore } from '../store/offlineStore';
import { t } from '../i18n';

interface UseOfflineReturn {
  isOnline: boolean;
  syncQueue: () => Promise<void>;
  queueLength: number;
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

    for (const item of queue) {
      try {
        if (item.type === 'sale') {
          // The queued payload goes up untouched — it is the body the till
          // already composed, and a replay that reshaped it would post a
          // different sale than the one the cashier rang up.
          await transport.request({ method: 'POST', path: 'sales', body: item.payload });
          removeFromQueue(item.id);
          synced++;
        }
      } catch {
        // Keep in queue if sync fails
      }
    }

    setSyncing(false);
    if (synced > 0) {
      toast.success(t('offline.synced', { count: synced }));
    }
  }, [isOnline, isSyncing, queue, removeFromQueue, setSyncing, transport]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
  }, [isOnline, queue.length, syncQueue]);

  return { isOnline, syncQueue, queueLength: queue.length };
}
