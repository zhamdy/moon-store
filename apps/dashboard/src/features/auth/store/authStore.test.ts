import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { useOfflineStore } from '../../../shared/store/offlineStore';
import { useCartStore, useHeldCartsStore } from '../../pos';
import { onSessionEvent } from '../../../shared/lib/session';
import { queryClient } from '../../../shared/lib/queryClient';
import type { AuthUser } from '../../../shared/types/index';

const mockUser: AuthUser = {
  id: 1,
  name: 'Sarah',
  email: 'sarah@moon.com',
  role: 'Cashier',
};

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
  useOfflineStore.getState().clearQueue();
  useCartStore.getState().clearCart();
});

describe('authStore.logout()', () => {
  // Characterization: written against the pre-U3 behavior (a direct
  // queryClient/offlineStore/cartStore teardown inside logout()) and must
  // keep passing once logout() instead emits a 'logout' session event.
  it('clears user, accessToken and isAuthenticated', () => {
    useAuthStore.setState({ user: mockUser, accessToken: 'tok', isAuthenticated: true });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('does not throw when logging out with no teardown subscriber wired', () => {
    // A bare store import (no app/session.ts equivalent wiring) must still
    // behave safely — this is the scenario most unit tests run under.
    useAuthStore.setState({ user: mockUser, accessToken: 'tok', isAuthenticated: true });

    expect(() => useAuthStore.getState().logout()).not.toThrow();
  });

  it("does not clear heldCartsStore (pins today's behavior)", () => {
    useHeldCartsStore.getState().holdCart('lunch', [], 0, 'percentage');
    expect(useHeldCartsStore.getState().carts).toHaveLength(1);

    useAuthStore.setState({ user: mockUser, accessToken: 'tok', isAuthenticated: true });
    useAuthStore.getState().logout();

    expect(useHeldCartsStore.getState().carts).toHaveLength(1);
    useHeldCartsStore.setState({ carts: [] });
  });

  it('with the composition-root teardown wired, drains queryClient, the offline queue and the cart', () => {
    // Mirrors app/session.ts's (currently main.tsx's) eager subscription,
    // in the same order as the pre-U3 inline teardown at authStore.ts:33-38.
    const unsubscribe = onSessionEvent('logout', () => {
      queryClient.clear();
      useOfflineStore.getState().clearQueue();
      useCartStore.getState().clearCart();
    });

    const clearSpy = vi.spyOn(queryClient, 'clear');
    useOfflineStore.getState().addToQueue({ type: 'sale', payload: {} });
    useCartStore.getState().addItem({ id: 1, name: 'Silk Dress', price: 500, stock: 10 });
    useAuthStore.setState({ user: mockUser, accessToken: 'tok', isAuthenticated: true });

    useAuthStore.getState().logout();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(useOfflineStore.getState().queue).toHaveLength(0);
    expect(useCartStore.getState().items).toHaveLength(0);

    clearSpy.mockRestore();
    unsubscribe();
  });
});
