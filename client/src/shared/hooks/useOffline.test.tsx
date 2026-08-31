import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError, TransportProvider } from '../lib/transport/index';
import type { Transport, TransportRequest, TransportResult } from '../lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../lib/transport/memory';
import {
  useOfflineStore,
  SALE_QUEUE_CONTRACT_VERSION,
  MAX_RETRYABLE_ATTEMPTS,
  RETRY_CEILING_MS,
} from '../store/offlineStore';
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
    queue: [
      {
        id: 1,
        createdAt: '2026-02-01T10:00:00.000Z',
        type: 'sale',
        payload: QUEUED_SALE,
        // Composed under the current checkout contract (Unit 6) -- see the
        // "quarantined legacy sale" tests below for the unversioned case.
        contractVersion: SALE_QUEUE_CONTRACT_VERSION,
      },
    ],
    isSyncing: false,
  });
}

function wrapperFor(transport: Transport) {
  return ({ children }: { children: ReactNode }) => (
    <TransportProvider transport={transport}>{children}</TransportProvider>
  );
}

/**
 * Rejects every replay with the same error, and records each attempt.
 *
 * It does NOT have to hang after the first failure the way its predecessor
 * did. That helper hung because the hook retried a failed replay as fast as
 * its event loop allowed, so a test could only observe post-failure state by
 * making the second attempt never resolve. Attempts are now spaced by an
 * explicit backoff, which is exactly what these tests count.
 */
function rejectingTransport(error: () => ApiError) {
  const attempts: TransportRequest[] = [];
  const transport: Transport = {
    request<T>(req: TransportRequest): Promise<TransportResult<T>> {
      attempts.push(req);
      return Promise.reject(error());
    },
  };
  return { transport, attempts };
}

/** Lets pending backoff timers and the promises they resolve into settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  // The next timer is armed by a React effect, which only runs once the sweep's
  // state updates have been committed -- so give that a turn before asserting.
  await act(async () => {});
}

describe('offline sale replay', () => {
  let online: PropertyDescriptor | undefined;

  beforeEach(() => {
    online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    useOfflineStore.setState({ queue: [], isSyncing: false });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('replays a queued sale under the idempotency key it was stamped with', async () => {
    const transport: MemoryTransport = createMemoryTransport({ sales: [] });
    useOfflineStore.setState({
      queue: [
        {
          id: 1,
          createdAt: '2026-02-01T10:00:00.000Z',
          type: 'sale',
          payload: QUEUED_SALE,
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
          idempotencyKey: 'checkout-attempt-key',
        },
      ],
      isSyncing: false,
    });

    renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(0));

    // The key the till stamped at ring-up, unchanged -- a replay under a fresh
    // key would let the server commit the sale a second time.
    expect(transport.idempotencyKeys()).toEqual(['checkout-attempt-key']);
  });

  it('replays a legacy entry that predates idempotency keys with no key at all', async () => {
    const transport: MemoryTransport = createMemoryTransport({ sales: [] });
    // Versioned (so not quarantined) but queued before keys existed.
    queueOneSale();

    renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(0));

    expect(transport.idempotencyKeys()).toEqual([]);
    expect(transport.calls()[0]).not.toHaveProperty('idempotencyKey');
  });

  it('does not replay anything while the till is offline', async () => {
    const transport: MemoryTransport = createMemoryTransport({ sales: [] });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    queueOneSale();

    const { result, unmount } = renderHook(() => useOffline(), {
      wrapper: wrapperFor(transport),
    });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(transport.calls()).toEqual([]);
    expect(useOfflineStore.getState().queue).toHaveLength(1);

    unmount();
  });

  it('never auto-replays an unversioned (legacy) queued sale', async () => {
    const transport: MemoryTransport = createMemoryTransport({ sales: [] });
    useOfflineStore.setState({
      queue: [
        // No `contractVersion` -- composed before this fix shipped, possibly
        // under the old, incorrect tip/loyalty formula. Never auto-replayed.
        { id: 1, createdAt: '2026-02-01T10:00:00.000Z', type: 'sale', payload: QUEUED_SALE },
      ],
      isSyncing: false,
    });

    const { result, unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(transport.calls()).toEqual([]);
    // Still there, visible for manual review -- not silently dropped either.
    expect(useOfflineStore.getState().queue).toHaveLength(1);

    unmount();
  });

  it('replays a versioned sale and leaves an unrelated quarantined legacy sale untouched, in the same mixed queue', async () => {
    const transport: MemoryTransport = createMemoryTransport({ sales: [] });
    useOfflineStore.setState({
      queue: [
        { id: 1, createdAt: '', type: 'sale', payload: QUEUED_SALE }, // legacy, quarantined
        {
          id: 2,
          createdAt: '',
          type: 'sale',
          payload: { ...QUEUED_SALE, items: [{ product_id: 9, quantity: 1, unit_price: 100 }] },
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
        },
      ],
      isSyncing: false,
    });

    renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(1));

    // Only the versioned entry was posted.
    expect(transport.calls()).toHaveLength(1);
    expect(transport.calls()[0].body).toMatchObject({
      items: [{ product_id: 9, quantity: 1, unit_price: 100 }],
    });
    // The legacy entry is still sitting in the queue, untouched.
    expect(useOfflineStore.getState().queue[0].id).toBe(1);
  });

  it('leaves a queued sale in place, without blocking sync, when the server rejects it as no longer balanced', async () => {
    const mismatchTransport: Transport = {
      request<T>(req: TransportRequest): Promise<TransportResult<T>> {
        if (req.method === 'POST' && req.path === 'sales') {
          return Promise.reject(
            new ApiError('Split payment mismatch', 400, 'VALIDATION_ERROR', [
              { field: 'payments', code: 'SPLIT_PAYMENT_MISMATCH', message: 'stale split' },
            ])
          );
        }
        return Promise.resolve({ data: undefined as T });
      },
    };
    useOfflineStore.setState({
      queue: [
        {
          id: 1,
          createdAt: '',
          type: 'sale',
          payload: QUEUED_SALE,
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
        },
      ],
      isSyncing: false,
    });

    const { unmount } = renderHook(() => useOffline(), {
      wrapper: wrapperFor(mismatchTransport),
    });

    // Not dropped, not resubmitted-as-successful -- stays for the cashier to
    // review and rebalance/re-ring.
    await waitFor(() => expect(useOfflineStore.getState().queue[0].mismatched).toBe(true));
    await waitFor(() => expect(useOfflineStore.getState().isSyncing).toBe(false));
    expect(useOfflineStore.getState().queue).toHaveLength(1);
    // Quarantined, not parked: the cashier sees one problem, not two.
    expect(useOfflineStore.getState().queue[0].syncFailed).toBeUndefined();

    unmount();
  });
});

describe('offline sale replay - backoff and parking', () => {
  let online: PropertyDescriptor | undefined;

  beforeEach(() => {
    online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    useOfflineStore.setState({ queue: [], isSyncing: false });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (online) Object.defineProperty(Navigator.prototype, 'onLine', online);
    useOfflineStore.setState({ queue: [], isSyncing: false });
  });

  it('makes exactly one attempt before any backoff has elapsed', async () => {
    // The issue's core claim. Before this fix the hook re-fired as fast as the
    // event loop allowed for as long as the queue was non-empty, so this count
    // was unbounded and a test could only observe state by hanging the second
    // attempt.
    const { transport, attempts } = rejectingTransport(() => new ApiError('', 500));
    queueOneSale();

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);
    expect(attempts).toHaveLength(1);

    // Nothing spins in the gap before the first backoff expires.
    await advance(500);
    expect(attempts).toHaveLength(1);

    unmount();
  });

  it('spaces each further attempt by a strictly longer backoff', async () => {
    const { transport, attempts } = rejectingTransport(() => new ApiError('', 500));
    queueOneSale();

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    // Elapsed times chosen so jitter cannot make any of these ambiguous.
    // Steps are 1s, 2s and 4s at +/-20%, so attempt 2 lands in [800, 1200],
    // attempt 3 in [2400, 3600] and attempt 4 in [5600, 8400] -- non-overlapping
    // windows, which is what "each gap is longer than the last" means here.
    await advance(0);
    expect(attempts).toHaveLength(1);

    await advance(1_500);
    expect(attempts).toHaveLength(2);

    // t=2000: still short of the earliest attempt 3.
    await advance(500);
    expect(attempts).toHaveLength(2);

    // t=4000: past the latest attempt 3, short of the earliest attempt 4.
    await advance(2_000);
    expect(attempts).toHaveLength(3);

    // t=9000: past the latest attempt 4, short of the earliest attempt 5.
    await advance(5_000);
    expect(attempts).toHaveLength(4);

    unmount();
  });

  it('dequeues and clears retry state when an attempt finally succeeds', async () => {
    let failures = 0;
    const transport: Transport = {
      request<T>(): Promise<TransportResult<T>> {
        if (failures++ < 2) return Promise.reject(new ApiError('', 503));
        return Promise.resolve({ data: undefined as T });
      },
    };
    queueOneSale();

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);
    expect(useOfflineStore.getState().queue[0].attempts).toBe(1);

    await advance(10_000);

    expect(useOfflineStore.getState().queue).toHaveLength(0);
    expect(failures).toBe(3);

    unmount();
  });

  it('parks a deterministic rejection on the first attempt and never retries it', async () => {
    const { transport, attempts } = rejectingTransport(
      () => new ApiError('bad request', 400, 'VALIDATION_ERROR')
    );
    queueOneSale();

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);

    const item = useOfflineStore.getState().queue[0];
    expect(item.syncFailed).toBe(true);
    expect(item.attempts).toBe(1);

    // However far the clock runs, a rejection the server will repeat verbatim
    // never consumes another attempt.
    await advance(RETRY_CEILING_MS * 20);
    expect(attempts).toHaveLength(1);

    unmount();
  });

  it('parks an entry once the retryable budget runs out, and stops attempting', async () => {
    const { transport, attempts } = rejectingTransport(() => new ApiError('', 500));
    queueOneSale();

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    // Comfortably past the full ladder: ten steps capped at five minutes each.
    // Stepped rather than one long jump, because each attempt's next timer is
    // armed by a React effect that has to run between them.
    for (let step = 0; step < MAX_RETRYABLE_ATTEMPTS + 2; step++) {
      await advance(RETRY_CEILING_MS * 2);
    }

    expect(attempts).toHaveLength(MAX_RETRYABLE_ATTEMPTS);
    expect(useOfflineStore.getState().queue[0].syncFailed).toBe(true);

    await advance(RETRY_CEILING_MS * 20);
    expect(attempts).toHaveLength(MAX_RETRYABLE_ATTEMPTS);
    // Parked, never dropped -- the sale is still recoverable.
    expect(useOfflineStore.getState().queue).toHaveLength(1);

    unmount();
  });

  it('does no work and arms no timer for a queue of only quarantined entries', async () => {
    // This is the case that busy-looped with zero network traffic: every entry
    // was skipped, yet a non-empty queue kept re-firing the effect.
    const { transport, attempts } = rejectingTransport(() => new ApiError('', 500));
    useOfflineStore.setState({
      queue: [
        { id: 1, createdAt: '', type: 'sale', payload: QUEUED_SALE }, // legacy
        {
          id: 2,
          createdAt: '',
          type: 'sale',
          payload: QUEUED_SALE,
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
          mismatched: true,
        },
      ],
      isSyncing: false,
    });

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);

    expect(attempts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    unmount();
  });

  it('arms no timer for a queue of only parked entries', async () => {
    const { transport, attempts } = rejectingTransport(() => new ApiError('', 500));
    useOfflineStore.setState({
      queue: [
        {
          id: 1,
          createdAt: '',
          type: 'sale',
          payload: QUEUED_SALE,
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
          attempts: MAX_RETRYABLE_ATTEMPTS,
          syncFailed: true,
        },
      ],
      isSyncing: false,
    });

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);

    expect(attempts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    unmount();
  });

  it('issues no request for an entry still inside its backoff window', async () => {
    const { transport, attempts } = rejectingTransport(() => new ApiError('', 500));
    useOfflineStore.setState({
      queue: [
        {
          id: 1,
          createdAt: '',
          type: 'sale',
          payload: QUEUED_SALE,
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
          attempts: 1,
          nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      isSyncing: false,
    });

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(59_000);
    expect(attempts).toEqual([]);

    await advance(2_000);
    expect(attempts).toHaveLength(1);

    unmount();
  });

  it('does not let a poison entry in backoff hold up a healthy one behind it', async () => {
    const transport: Transport = {
      request<T>(req: TransportRequest): Promise<TransportResult<T>> {
        const body = req.body as { poison?: boolean };
        if (body.poison) return Promise.reject(new ApiError('', 500));
        return Promise.resolve({ data: undefined as T });
      },
    };
    useOfflineStore.setState({
      queue: [
        {
          id: 1,
          createdAt: '',
          type: 'sale',
          payload: { poison: true },
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
        },
        {
          id: 2,
          createdAt: '',
          type: 'sale',
          payload: { poison: false },
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
        },
      ],
      isSyncing: false,
    });

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);

    // The healthy sale went through on the same sweep the poison one failed on.
    expect(useOfflineStore.getState().queue.map((item) => item.id)).toEqual([1]);
    expect(useOfflineStore.getState().queue[0].attempts).toBe(1);

    unmount();
  });

  it('retries immediately when the till reconnects, without forgiving attempts', async () => {
    const { transport, attempts } = rejectingTransport(() => new ApiError('', 500));
    useOfflineStore.setState({
      queue: [
        {
          id: 1,
          createdAt: '',
          type: 'sale',
          payload: QUEUED_SALE,
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
          attempts: 3,
          nextAttemptAt: new Date(Date.now() + RETRY_CEILING_MS).toISOString(),
        },
      ],
      isSyncing: false,
    });

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);
    expect(attempts).toEqual([]);

    // A backoff computed against a dead link says nothing about a live one.
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await advance(0);

    expect(attempts).toHaveLength(1);
    // Attempt 4, not attempt 1: reconnecting is not a free pass for a sale the
    // server keeps rejecting.
    expect(useOfflineStore.getState().queue[0].attempts).toBe(4);

    unmount();
  });

  it('replays under the same key on every retry, never a fresh one', async () => {
    const { transport, attempts } = rejectingTransport(() => new ApiError('', 500));
    useOfflineStore.setState({
      queue: [
        {
          id: 1,
          createdAt: '',
          type: 'sale',
          payload: QUEUED_SALE,
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
          idempotencyKey: 'checkout-attempt-key',
        },
      ],
      isSyncing: false,
    });

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);
    await advance(10_000);

    expect(attempts.length).toBeGreaterThan(1);
    // A fresh key per retry would let the server commit the sale once per
    // attempt -- the exact double-charge the key exists to prevent.
    expect(new Set(attempts.map((req) => req.idempotencyKey))).toEqual(
      new Set(['checkout-attempt-key'])
    );

    unmount();
  });

  it('clears its pending backoff timer on unmount', async () => {
    const { transport } = rejectingTransport(() => new ApiError('', 500));
    queueOneSale();

    const { unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('puts a parked sale back in play when the cashier retries it', async () => {
    let reject = true;
    const transport: Transport = {
      request<T>(): Promise<TransportResult<T>> {
        if (reject) return Promise.reject(new ApiError('bad request', 400));
        return Promise.resolve({ data: undefined as T });
      },
    };
    queueOneSale();

    const { result, unmount } = renderHook(() => useOffline(), { wrapper: wrapperFor(transport) });

    await advance(0);
    expect(result.current.failedCount).toBe(1);
    expect(result.current.quarantinedCount).toBe(0);

    reject = false;
    await act(async () => {
      result.current.retryFailed();
    });
    await advance(0);

    expect(useOfflineStore.getState().queue).toHaveLength(0);

    unmount();
  });
});
