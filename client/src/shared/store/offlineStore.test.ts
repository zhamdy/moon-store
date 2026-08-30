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
