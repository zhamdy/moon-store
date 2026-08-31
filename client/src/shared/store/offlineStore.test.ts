import { describe, it, expect, beforeEach } from 'vitest';
import { OFFLINE_QUEUE_STORAGE_KEY } from '@/shared/lib/storageKeys';
import { useOfflineStore, isQuarantined, SALE_QUEUE_CONTRACT_VERSION } from './offlineStore';

beforeEach(() => {
  useOfflineStore.setState({ queue: [], isSyncing: false });
});

describe('offlineStore - addToQueue', () => {
  it('stamps whatever contractVersion the caller passes', () => {
    useOfflineStore
      .getState()
      .addToQueue({ type: 'sale', payload: {}, contractVersion: SALE_QUEUE_CONTRACT_VERSION });

    expect(useOfflineStore.getState().queue[0].contractVersion).toBe(SALE_QUEUE_CONTRACT_VERSION);
  });

  it('leaves contractVersion unset when the caller omits it (legacy call site)', () => {
    useOfflineStore.getState().addToQueue({ type: 'sale', payload: {} });

    expect(useOfflineStore.getState().queue[0].contractVersion).toBeUndefined();
  });

  it('carries an idempotency key when the caller passes one, and leaves it unset otherwise', () => {
    const { addToQueue } = useOfflineStore.getState();
    addToQueue({ type: 'sale', payload: {}, idempotencyKey: 'key-abc' });
    addToQueue({ type: 'sale', payload: {} });

    expect(useOfflineStore.getState().queue[0].idempotencyKey).toBe('key-abc');
    // A legacy entry has no key at all -- not an empty string, which would be
    // sent as a malformed header on replay.
    expect(useOfflineStore.getState().queue[1].idempotencyKey).toBeUndefined();
  });
});

describe('offlineStore - persistence', () => {
  it('preserves the idempotency key across a reload between queueing and replay', async () => {
    useOfflineStore.getState().addToQueue({
      type: 'sale',
      payload: { items: [] },
      contractVersion: SALE_QUEUE_CONTRACT_VERSION,
      idempotencyKey: 'key-survives-reload',
    });

    // What the persist middleware actually wrote is the only thing a reloaded
    // till gets to see, so assert on storage rather than on live state.
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    expect(JSON.parse(raw ?? '{}').state.queue[0].idempotencyKey).toBe('key-survives-reload');

    // A reload starts from empty in-memory state plus whatever storage holds.
    // (Clearing the state also rewrites storage, so put the snapshot back.)
    useOfflineStore.setState({ queue: [], isSyncing: false });
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, raw as string);
    await useOfflineStore.persist.rehydrate();

    expect(useOfflineStore.getState().queue[0].idempotencyKey).toBe('key-survives-reload');
  });
});

describe('isQuarantined', () => {
  it('quarantines an unversioned sale entry', () => {
    expect(isQuarantined({ type: 'sale', payload: {} })).toBe(true);
  });

  it('does not quarantine a versioned sale entry', () => {
    expect(
      isQuarantined({ type: 'sale', payload: {}, contractVersion: SALE_QUEUE_CONTRACT_VERSION })
    ).toBe(false);
  });

  it('does not quarantine a non-sale entry regardless of contractVersion', () => {
    expect(isQuarantined({ type: 'inventory-adjustment', payload: {} })).toBe(false);
  });
});

describe('offlineStore - getQuarantinedCount', () => {
  it('counts only unversioned sale entries in a mixed queue', () => {
    useOfflineStore.setState({
      isSyncing: false,
      queue: [
        { id: 1, createdAt: '', type: 'sale', payload: {} }, // legacy, quarantined
        {
          id: 2,
          createdAt: '',
          type: 'sale',
          payload: {},
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
        }, // current, not quarantined
        { id: 3, createdAt: '', type: 'inventory-adjustment', payload: {} }, // other action, not quarantined
      ],
    });

    expect(useOfflineStore.getState().getQuarantinedCount()).toBe(1);
    expect(useOfflineStore.getState().getQueueLength()).toBe(3);
  });
});

describe('offlineStore - queue entry identity', () => {
  it('gives two entries queued in the same millisecond distinct ids', () => {
    const { addToQueue } = useOfflineStore.getState();
    addToQueue({ type: 'sale', payload: { n: 1 } });
    addToQueue({ type: 'sale', payload: { n: 2 } });

    const [first, second] = useOfflineStore.getState().queue;
    expect(first.id).not.toBe(second.id);
  });

  it('removes exactly the entry asked for when two were queued back to back', () => {
    const { addToQueue } = useOfflineStore.getState();
    addToQueue({ type: 'sale', payload: { n: 1 } });
    addToQueue({ type: 'sale', payload: { n: 2 } });

    const [first, second] = useOfflineStore.getState().queue;
    useOfflineStore.getState().removeFromQueue(first.id);

    // Under `Date.now()` ids these two collided and this deleted both -- an
    // unrecoverable, silent loss of a rung-up sale.
    const remaining = useOfflineStore.getState().queue;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
    expect(remaining[0].payload).toEqual({ n: 2 });
  });

  it('flags exactly one entry when two were queued back to back', () => {
    const { addToQueue } = useOfflineStore.getState();
    addToQueue({ type: 'sale', payload: { n: 1 } });
    addToQueue({ type: 'sale', payload: { n: 2 } });

    const [first] = useOfflineStore.getState().queue;
    useOfflineStore.getState().markMismatched(first.id);

    expect(useOfflineStore.getState().queue.map((item) => item.mismatched)).toEqual([
      true,
      undefined,
    ]);
  });

  it('still removes an entry rehydrated with a legacy numeric id', () => {
    // The shape a till that updated mid-shift finds in its localStorage.
    useOfflineStore.setState({
      queue: [
        { id: 1738000000000, createdAt: '', type: 'sale', payload: {} },
        { id: 'str-id', createdAt: '', type: 'sale', payload: {} },
      ],
      isSyncing: false,
    });

    useOfflineStore.getState().removeFromQueue(1738000000000);

    expect(useOfflineStore.getState().queue.map((item) => item.id)).toEqual(['str-id']);
  });

  it('preserves generated ids across a persist round-trip', async () => {
    useOfflineStore.getState().addToQueue({ type: 'sale', payload: {} });
    const id = useOfflineStore.getState().queue[0].id;
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) as string;

    useOfflineStore.setState({ queue: [], isSyncing: false });
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, raw);
    await useOfflineStore.persist.rehydrate();

    expect(useOfflineStore.getState().queue[0].id).toBe(id);
  });
});
