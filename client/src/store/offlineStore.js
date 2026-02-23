import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useOfflineStore = create(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,

      addToQueue: (action) =>
        set((state) => ({
          queue: [...state.queue, { ...action, id: Date.now(), createdAt: new Date().toISOString() }],
        })),

      removeFromQueue: (id) =>
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        })),

      clearQueue: () => set({ queue: [] }),

      setSyncing: (isSyncing) => set({ isSyncing }),

      getQueueLength: () => get().queue.length,
    }),
    {
      name: 'moon-offline-queue',
    }
  )
);
