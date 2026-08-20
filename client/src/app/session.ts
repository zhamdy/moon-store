// Composition-root session wiring. Imported by main.tsx for its side effect,
// before createRoot, so both installations below are active before any
// request or logout can occur.
//
// This is the one place `shared/`-equivalent transport code is wired to
// `features/auth`-equivalent state (auth-port inversion, U2) and the one
// place the `logout` session event is wired to its cross-slice teardown
// (logout-teardown inversion, U3). See docs/plans High-Level Technical
// Design for why both live here rather than self-registering inside their
// respective stores.
import { queryClient } from '../shared/lib/queryClient';
import { setAuthPort } from '../shared/lib/transport/index';
import { onSessionEvent } from '../shared/lib/session';
import { useAuthStore } from '../features/auth/store/authStore';
import { useOfflineStore } from '../shared/store/offlineStore';
import { useCartStore } from '../features/pos/store/cartStore';

setAuthPort({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onTokenRefreshed: (user, accessToken) => useAuthStore.getState().login(user, accessToken),
  onAuthFailure: () => {
    useAuthStore.getState().logout();
    window.location.href = '/login';
  },
});

// Subscribed here, eagerly, rather than self-registered inside cartStore:
// cartStore is persisted, so a subscriber that only registers when its
// module is first imported would silently skip the cart clear on a logout
// from a page that never loaded the POS chunk. Order matches the pre-U3
// inline teardown at authStore.ts:33-38.
onSessionEvent('logout', () => {
  queryClient.clear();
  useOfflineStore.getState().clearQueue();
  useCartStore.getState().clearCart();
});
