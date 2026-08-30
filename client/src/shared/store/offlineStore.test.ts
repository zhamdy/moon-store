import { describe, it, expect, beforeEach } from 'vitest';
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
