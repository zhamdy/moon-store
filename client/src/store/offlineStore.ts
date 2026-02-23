import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OfflineAction {
  type: string;
  payload: Record<string, unknown>;
}

export interface OfflineQueueItem extends OfflineAction {
  id: number;
  createdAt: string;
}

interface OfflineState {
  queue: OfflineQueueItem[];
  isSyncing: boolean;
  addToQueue: (action: OfflineAction) => void;
  removeFromQueue: (id: number) => void;
  clearQueue: () => void;
  setSyncing: (isSyncing: boolean) => void;
  getQueueLength: () => number;
}

export const useOfflineStore = create<OfflineState>()(
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
