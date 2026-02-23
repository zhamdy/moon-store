import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useOfflineStore } from '../store/offlineStore';
import { t } from '../i18n';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { queue, removeFromQueue, setSyncing, isSyncing } = useOfflineStore();

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
          await api.post('/api/sales', item.payload);
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
  }, [isOnline, isSyncing, queue, removeFromQueue, setSyncing]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
  }, [isOnline, queue.length, syncQueue]);

  return { isOnline, syncQueue, queueLength: queue.length };
}
