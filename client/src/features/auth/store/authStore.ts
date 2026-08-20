import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { emitSessionEvent } from '../../../shared/lib/session';
import { AUTH_STORAGE_KEY } from '../../../shared/lib/storageKeys';
import type { AuthUser } from '../../../shared/types/index';

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
        emitSessionEvent('logout');
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
