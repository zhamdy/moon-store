import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { queryClient } from './lib/queryClient';
import { setAuthPort } from './lib/transport';
import { onSessionEvent } from './lib/session';
import { useAuthStore } from './store/authStore';
import { useOfflineStore } from './store/offlineStore';
import { useCartStore } from './store/cartStore';
import { useSettingsStore } from './store/settingsStore';
import './index.css';

// Installs the real auth port before anything in the transport layer can run
// a request. This is the one place `shared/`-equivalent transport code is
// wired to `features/auth`-equivalent state; see docs/plans auth-port
// inversion (Unit 2). Moves into app/session.ts in Unit 6.
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
// inline teardown at authStore.ts:33-38. Moves into app/session.ts in Unit 6.
onSessionEvent('logout', () => {
  queryClient.clear();
  useOfflineStore.getState().clearQueue();
  useCartStore.getState().clearCart();
});

function ThemedToaster(): React.ReactElement {
  const theme = useSettingsStore((s) => s.theme);
  const isDark = theme === 'dark';
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: isDark ? '#141414' : '#FFFFFF',
          color: isDark ? '#F5F0E8' : '#1E1E1E',
          border: `1px solid ${isDark ? '#1E1E1E' : '#E0E0E0'}`,
          fontFamily: 'Inter, Cairo, sans-serif',
        },
        success: {
          iconTheme: { primary: '#C9A96E', secondary: isDark ? '#0D0D0D' : '#FFFFFF' },
        },
        error: {
          iconTheme: { primary: '#EF4444', secondary: isDark ? '#0D0D0D' : '#FFFFFF' },
        },
      }}
    />
  );
}

// Hydrate settings (theme/locale) synchronously before render to prevent FOUC
useSettingsStore.getState().hydrate();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ThemedToaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
