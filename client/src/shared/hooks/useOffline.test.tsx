import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { ApiError, TransportProvider } from '../lib/transport/index';
import type { Transport, TransportRequest, TransportResult } from '../lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../lib/transport/memory';
import { useOfflineStore } from '../store/offlineStore';
import { useOffline } from './useOffline';

/**
 * The body CartPanel queues when the till loses its connection mid-checkout —
 * copied from the shape that test asserts on. The replay has to send this
 * object through untouched: a sale rung up offline is the same sale when it
 * lands, and any reshaping here would post something the cashier never saw.
 */
const QUEUED_SALE = {
  items: [{ product_id: 7, quantity: 2, unit_price: 250 }],
  discount: 10,
  discount_type: 'percentage',
  payment_method: 'Cash',
};

function queueOneSale() {
  useOfflineStore.setState({
    queue: [{ id: 1, createdAt: '2026-02-01T10:00:00.000Z', type: 'sale', payload: QUEUED_SALE }],
    isSyncing: false,
  });
}

function wrapperFor(transport: Transport) {
  return ({ children }: { children: ReactNode }) => (
    <TransportProvider transport={transport}>{children}</TransportProvider>
  );
}

/**
 * Fails the first replay outright and then hangs. The hook retries a failed
 * replay for as long as the queue is non-empty, so hanging the second attempt
 * stops the test observing a spin rather than the state after one failure.
 */
function failingTransport() {
  const attempts: TransportRequest[] = [];
  const transport: Transport = {
    request<T>(req: TransportRequest): Promise<TransportResult<T>> {
      attempts.push(req);
      if (attempts.length === 1) return Promise.reject(new ApiError('', 500));
      return new Promise<TransportResult<T>>(() => {});
    },
  };
  return { transport, attempts };
}

describe('offline sale replay', () => {
  let online: PropertyDescriptor | undefined;

  beforeEach(() => {
    online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    useOfflineStore.setState({ queue: [], isSyncing: false });
  });

  afterEach(() => {
    if (online) Object.defineProperty(Navigator.prototype, 'onLine', online);
    useOfflineStore.setState({ queue: [], isSyncing: false });
  });

  it('replays a queued sale with the exact body it was queued with', async () => {
    const transport: MemoryTransport = createMemoryTransport({ sales: [] });
    queueOneSale();

    renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(0));

    // Exactly one POST: a sale that replayed twice would be charged twice.
    expect(transport.calls()).toEqual([{ method: 'POST', path: 'sales', body: QUEUED_SALE }]);
    // Not merely equal — the same object, so nothing rebuilt the body on the way.
    expect(transport.calls()[0].body).toBe(QUEUED_SALE);
  });

  it('leaves a sale queued when the replay fails', async () => {
    const { transport, attempts } = failingTransport();
    queueOneSale();

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await waitFor(() => expect(attempts.length).toBeGreaterThanOrEqual(1));
    expect(attempts[0]).toEqual({ method: 'POST', path: 'sales', body: QUEUED_SALE });

    // No attempt ever succeeds here, so the queue holding the sale is true at
    // every instant rather than at one the assertion happened to catch.
    expect(useOfflineStore.getState().queue).toHaveLength(1);
    expect(useOfflineStore.getState().queue[0].payload).toBe(QUEUED_SALE);

    unmount();
  });

  it('does not replay anything while the till is offline', async () => {
    const transport: MemoryTransport = createMemoryTransport({ sales: [] });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    queueOneSale();

    const { result, unmount } = renderHook(() => useOffline(), {
      wrapper: wrapperFor(transport),
    });

    await result.current.syncQueue();

    expect(transport.calls()).toEqual([]);
    expect(useOfflineStore.getState().queue).toHaveLength(1);

    unmount();
  });
});
