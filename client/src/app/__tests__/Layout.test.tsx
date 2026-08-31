import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth';
import { useSettingsStore } from '@/shared/store/settingsStore';
import { useOfflineStore, SALE_QUEUE_CONTRACT_VERSION } from '@/shared/store/offlineStore';
import { TransportProvider } from '@/shared/lib/transport/index';
import { createMemoryTransport } from '@/shared/lib/transport/memory';
import en from '@/shared/i18n/en.json';
import ar from '@/shared/i18n/ar.json';
import Layout from '../Layout';

const ADMIN = { id: 1, name: 'Admin User', email: 'admin@moon.com', role: 'Admin' as const };

/** A sale that would replay cleanly if anything ever asked it to. */
const healthySale = (id: string) => ({
  id,
  createdAt: '',
  type: 'sale',
  payload: {},
  contractVersion: SALE_QUEUE_CONTRACT_VERSION,
});

/**
 * Layout renders an `<Outlet/>`, so handing it to `renderWithRouter` as the
 * `ui` mounts it as both the root and the index component -- Layout nested
 * inside itself, two schedulers, two banners, and every assertion needing
 * `getAllBy*`. That is not the shipped environment, so this builds the router
 * the real app has: Layout at the root, a page inside it.
 */
function renderLayout() {
  const transport = createMemoryTransport({ sales: [] });
  const rootRoute = createRootRoute({
    component: () => (
      <TransportProvider transport={transport}>
        <Layout />
      </TransportProvider>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>page</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  return {
    transport,
    ...render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>
    ),
  };
}

/** The shipped English copy, so a wording change is not a test failure. */
function copy(key: string, count: number): string {
  return (en as Record<string, string>)[key].replace('{count}', String(count));
}

describe('Layout - queued sale review banner', () => {
  let online: PropertyDescriptor | undefined;

  beforeEach(() => {
    online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({ user: ADMIN, isAuthenticated: true });
    useOfflineStore.setState({ queue: [], isSyncing: false });
  });

  afterEach(() => {
    if (online) Object.defineProperty(Navigator.prototype, 'onLine', online);
    useOfflineStore.setState({ queue: [], isSyncing: false });
  });

  it('names how many sales failed to sync', async () => {
    useOfflineStore.setState({
      queue: [
        { ...healthySale('a'), syncFailed: true, attempts: 10 },
        { ...healthySale('b'), syncFailed: true, attempts: 10 },
      ],
      isSyncing: false,
    });

    renderLayout();

    // One banner, not two: Layout must not be mounted inside itself here, or
    // every count below would be asserted against a duplicate render.
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(copy('offline.failedToSync', 2));
  });

  it('puts every parked sale back in play when Retry is pressed', async () => {
    useOfflineStore.setState({
      queue: [
        { ...healthySale('a'), syncFailed: true, attempts: 10, nextAttemptAt: undefined },
        { ...healthySale('b'), syncFailed: true, attempts: 10 },
      ],
      isSyncing: false,
    });

    const { transport } = renderLayout();
    const salePosts = () =>
      transport.calls().filter((call) => call.method === 'POST' && call.path === 'sales');

    // Parked means parked: nothing was replayed on its own.
    const retry = await screen.findByRole('button', { name: en['offline.retry'] });
    expect(salePosts()).toEqual([]);

    fireEvent.click(retry);

    // Retry clears the parked state itself...
    await waitFor(() =>
      expect(useOfflineStore.getState().queue.every((item) => item.syncFailed === undefined)).toBe(
        true
      )
    );
    expect(useOfflineStore.getState().queue.every((item) => item.attempts === undefined)).toBe(
      true
    );

    // ...and the scheduler takes it from there.
    await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(0));
    expect(salePosts()).toHaveLength(2);
  });

  it('counts quarantined and parked sales independently', async () => {
    useOfflineStore.setState({
      queue: [
        { id: 'legacy', createdAt: '', type: 'sale', payload: {} }, // quarantined
        { ...healthySale('a'), syncFailed: true, attempts: 10 }, // parked
      ],
      isSyncing: false,
    });

    renderLayout();

    // A parked sale is not a quarantined one: the cashier's next step differs.
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(copy('offline.quarantinedForReview', 1));
    expect(banner).toHaveTextContent(copy('offline.failedToSync', 1));
  });

  it('renders no review banner for a healthy queue', async () => {
    useOfflineStore.setState({ queue: [healthySale('a')], isSyncing: false });

    renderLayout();

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: en['offline.retry'] })).not.toBeInTheDocument();
  });

  it('still names parked sales while the till is offline', async () => {
    // The review banner is gated on being online, so without this the one sale
    // that will never sync on its own hides behind "queued for sync" -- which
    // promises the opposite.
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    useOfflineStore.setState({
      queue: [healthySale('a'), { ...healthySale('b'), syncFailed: true, attempts: 17 }],
      isSyncing: false,
    });

    renderLayout();

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(copy('offline.failedToSync', 1));
  });

  it('composes the offline banner as it did before', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    useOfflineStore.setState({
      queue: [healthySale('a'), { id: 'legacy', createdAt: '', type: 'sale', payload: {} }],
      isSyncing: false,
    });

    renderLayout();

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(en['offline.offlineBanner']);
    expect(banner).toHaveTextContent(copy('offline.queuedForSync', 2));
    expect(banner).toHaveTextContent(copy('offline.quarantinedForReview', 1));
  });

  it('gives the Retry control an accessible name and keyboard reach', async () => {
    useOfflineStore.setState({
      queue: [{ ...healthySale('a'), syncFailed: true, attempts: 10 }],
      isSyncing: false,
    });

    renderLayout();

    const retry = await screen.findByRole('button', { name: en['offline.retry'] });
    retry.focus();
    expect(retry).toHaveFocus();
  });
});

describe('i18n key parity', () => {
  it('keeps en.json and ar.json at identical key sets', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort());
  });

  it('carries the new offline review keys in both locales', () => {
    for (const bundle of [en, ar]) {
      expect(bundle).toHaveProperty('offline.failedToSync');
      expect(bundle).toHaveProperty('offline.retry');
    }
  });
});
