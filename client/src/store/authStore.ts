import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '../lib/queryClient';
import { useOfflineStore } from './offlineStore';
import { useCartStore } from './cartStore';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () => {
        set({ user: null, accessToken: null, isAuthenticated: false });
        queryClient.clear();
        useOfflineStore.getState().clearQueue();
        useCartStore.getState().clearCart();
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'moon-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
