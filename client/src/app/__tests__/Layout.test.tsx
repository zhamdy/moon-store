import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/features/auth';
import { useSettingsStore } from '@/shared/store/settingsStore';
import { useOfflineStore, SALE_QUEUE_CONTRACT_VERSION } from '@/shared/store/offlineStore';
import { TransportProvider } from '@/shared/lib/transport/index';
import { createMemoryTransport } from '@/shared/lib/transport/memory';
import { renderWithRouter } from '@/shared/tests/routerTestUtils';
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

function renderLayout() {
  const transport = createMemoryTransport({ sales: [] });
  return {
    transport,
    ...renderWithRouter(
      <TransportProvider transport={transport}>
        <Layout />
      </TransportProvider>,
      { initialRoute: '/', authState: { isAuthenticated: true, user: ADMIN } }
    ),
  };
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

    expect(await screen.findAllByText(/2 queued sale\(s\) failed to sync/i)).not.toHaveLength(0);
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

    // Parked means parked: nothing was replayed on its own.
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: /retry/i })).not.toHaveLength(0)
    );
    const salePosts = () =>
      transport.calls().filter((call) => call.method === 'POST' && call.path === 'sales');
    expect(salePosts()).toEqual([]);

    fireEvent.click((await screen.findAllByRole('button', { name: /retry/i }))[0]);

    // Back in play: the scheduler picks them up and both replay.
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

    expect(await screen.findAllByText(/1 of these need manual review/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/1 queued sale\(s\) failed to sync/i)).not.toHaveLength(0);
  });

  it('renders no review banner for a healthy queue', async () => {
    useOfflineStore.setState({ queue: [healthySale('a')], isSyncing: false });

    renderLayout();

    await waitFor(() => expect(screen.queryAllByText(/failed to sync/i)).toHaveLength(0));
    expect(screen.queryAllByText(/need manual review/i)).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /^retry$/i })).toHaveLength(0);
  });

  it('composes the offline banner exactly as it did before', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    useOfflineStore.setState({
      queue: [healthySale('a'), { id: 'legacy', createdAt: '', type: 'sale', payload: {} }],
      isSyncing: false,
    });

    renderLayout();

    expect(await screen.findAllByText(/You are offline\./)).not.toHaveLength(0);
    expect(screen.getAllByText(/2 item\(s\) queued for sync/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/1 of these need manual review/i)).not.toHaveLength(0);
  });

  it('gives the Retry control an accessible name and keyboard reach', async () => {
    useOfflineStore.setState({
      queue: [{ ...healthySale('a'), syncFailed: true, attempts: 10 }],
      isSyncing: false,
    });

    renderLayout();

    const [retry] = await screen.findAllByRole('button', { name: /retry/i });
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
