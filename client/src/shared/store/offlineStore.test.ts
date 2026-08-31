import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OFFLINE_QUEUE_STORAGE_KEY } from '@/shared/lib/storageKeys';
import {
  useOfflineStore,
  isQuarantined,
  needsReview,
  isParked,
  isDue,
  isEligible,
  earliestAttemptAt,
  migrateQueueIds,
  SALE_QUEUE_CONTRACT_VERSION,
  type OfflineQueueItemId,
} from './offlineStore';
import {
  nextAttemptDelay,
  MAX_RETRYABLE_ATTEMPTS,
  RETRY_BASE_MS,
  RETRY_CEILING_MS,
  RETRY_JITTER,
} from '@/shared/lib/offlineRetry';

beforeEach(() => {
  useOfflineStore.setState({ queue: [], isSyncing: false });
  localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
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
  // Freeze the clock. Without this these tests only exercise the collision
  // when two addToQueue calls happen to land in the same millisecond -- so
  // reintroducing `id: Date.now()` would pass whenever the clock ticked
  // between them, which on a loaded CI box is most of the time.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

describe('offlineStore - nextAttemptDelay', () => {
  it('grows exponentially and then holds at the ceiling, within the jitter band', () => {
    for (let attempts = 1; attempts <= MAX_RETRYABLE_ATTEMPTS; attempts++) {
      const expected = Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_CEILING_MS);
      for (let sample = 0; sample < 50; sample++) {
        const delay = nextAttemptDelay(attempts);
        expect(delay).toBeGreaterThanOrEqual(Math.floor(expected * (1 - RETRY_JITTER)));
        expect(delay).toBeLessThanOrEqual(Math.ceil(expected * (1 + RETRY_JITTER)));
      }
    }
  });

  it('never exceeds the ceiling band however many attempts have been made', () => {
    for (const attempts of [MAX_RETRYABLE_ATTEMPTS, 40, 1000]) {
      expect(nextAttemptDelay(attempts)).toBeLessThanOrEqual(
        Math.ceil(RETRY_CEILING_MS * (1 + RETRY_JITTER))
      );
    }
  });
});

describe('offlineStore - recordFailure', () => {
  function queueOne(): OfflineQueueItemId {
    useOfflineStore.getState().addToQueue({
      type: 'sale',
      payload: { n: 1 },
      contractVersion: SALE_QUEUE_CONTRACT_VERSION,
      idempotencyKey: 'key-1',
    });
    return useOfflineStore.getState().queue[0].id;
  }

  it('counts a retryable failure and schedules the next attempt in the future', () => {
    const id = queueOne();
    useOfflineStore.getState().recordFailure(id, { retryable: true, reason: 'server-error' });

    const item = useOfflineStore.getState().queue[0];
    expect(item.attempts).toBe(1);
    expect(item.syncFailed).toBeUndefined();
    expect(item.lastFailure).toBe('server-error');
    expect(Date.parse(item.nextAttemptAt as string)).toBeGreaterThan(Date.now());
  });

  it('pushes each consecutive retryable failure further out, up to the ceiling', () => {
    const id = queueOne();
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      const before = Date.now();
      useOfflineStore.getState().recordFailure(id, { retryable: true, reason: 'server-error' });
      const at = Date.parse(useOfflineStore.getState().queue[0].nextAttemptAt as string);
      delays.push(at - before);
    }

    // Jitter makes strict monotonicity a flaky assertion; the doubling band is
    // the actual policy, so assert that instead. The few ms of slack absorb the
    // real-clock drift between `before` and the store's own Date.now() -- the
    // band is otherwise exact at the top, and a single millisecond would fail.
    const SLACK_MS = 50;
    delays.forEach((delay, i) => {
      const expected = Math.min(RETRY_BASE_MS * 2 ** i, RETRY_CEILING_MS);
      expect(delay).toBeGreaterThanOrEqual(Math.floor(expected * (1 - RETRY_JITTER)) - SLACK_MS);
      expect(delay).toBeLessThanOrEqual(Math.ceil(expected * (1 + RETRY_JITTER)) + SLACK_MS);
    });
  });

  it('parks a terminal failure immediately without consuming the retry budget', () => {
    const id = queueOne();
    useOfflineStore.getState().recordFailure(id, { retryable: false, reason: 'key-reused' });

    const item = useOfflineStore.getState().queue[0];
    expect(item.syncFailed).toBe(true);
    expect(item.attempts).toBe(1);
    expect(item.nextAttemptAt).toBeUndefined();
    expect(item.lastFailure).toBe('key-reused');
  });

  it('parks the entry once the retryable budget is exhausted, rather than scheduling again', () => {
    const id = queueOne();
    for (let i = 0; i < MAX_RETRYABLE_ATTEMPTS - 1; i++) {
      useOfflineStore.getState().recordFailure(id, { retryable: true, reason: 'server-error' });
      expect(useOfflineStore.getState().queue[0].syncFailed).toBeUndefined();
    }

    useOfflineStore.getState().recordFailure(id, { retryable: true, reason: 'server-error' });

    const item = useOfflineStore.getState().queue[0];
    expect(item.attempts).toBe(MAX_RETRYABLE_ATTEMPTS);
    expect(item.syncFailed).toBe(true);
    expect(item.nextAttemptAt).toBeUndefined();
  });

  it('touches only the entry named', () => {
    const { addToQueue } = useOfflineStore.getState();
    addToQueue({ type: 'sale', payload: { n: 1 } });
    addToQueue({ type: 'sale', payload: { n: 2 } });
    const [first, second] = useOfflineStore.getState().queue;

    useOfflineStore.getState().recordFailure(first.id, { retryable: true, reason: 'x' });

    expect(useOfflineStore.getState().queue[1]).toEqual(second);
  });
});

describe('offlineStore - clearRetryState and clearBackoff', () => {
  it('clears retry state but preserves payload, key and contract version', () => {
    useOfflineStore.setState({
      queue: [
        {
          id: 'a',
          createdAt: '',
          type: 'sale',
          payload: { n: 1 },
          contractVersion: SALE_QUEUE_CONTRACT_VERSION,
          idempotencyKey: 'key-1',
          attempts: 4,
          nextAttemptAt: '2999-01-01T00:00:00.000Z',
          syncFailed: true,
          lastFailure: 'server-error',
        },
      ],
      isSyncing: false,
    });

    useOfflineStore.getState().clearRetryState('a');

    expect(useOfflineStore.getState().queue[0]).toEqual({
      id: 'a',
      createdAt: '',
      type: 'sale',
      payload: { n: 1 },
      contractVersion: SALE_QUEUE_CONTRACT_VERSION,
      // Preserved on purpose: if the original attempt did commit, the manual
      // retry replays onto the same key rather than charging a second time.
      idempotencyKey: 'key-1',
    });
  });

  it('revives every parked entry when called with no id, and leaves healthy ones alone', () => {
    useOfflineStore.setState({
      queue: [
        // Carries a backoff as well as the parked flag: a Retry that cleared
        // syncFailed but left nextAttemptAt would un-park the sale into a wait
        // the cashier cannot see and did not ask for.
        {
          id: 'a',
          createdAt: '',
          type: 'sale',
          payload: {},
          attempts: 10,
          syncFailed: true,
          nextAttemptAt: '2999-01-01T00:00:00.000Z',
        },
        { id: 'b', createdAt: '', type: 'sale', payload: {}, attempts: 10, syncFailed: true },
        { id: 'c', createdAt: '', type: 'sale', payload: {}, attempts: 2, nextAttemptAt: 'x' },
      ],
      isSyncing: false,
    });

    useOfflineStore.getState().clearRetryState();

    const [a, b, c] = useOfflineStore.getState().queue;
    expect(a.syncFailed).toBeUndefined();
    expect(a.attempts).toBeUndefined();
    expect(a.nextAttemptAt).toBeUndefined();
    expect(isParked(a)).toBe(false);
    expect(b.syncFailed).toBeUndefined();
    expect(c.attempts).toBe(2);
  });

  it('drops pending backoff on reconnect without forgiving attempts', () => {
    useOfflineStore.setState({
      queue: [
        {
          id: 'a',
          createdAt: '',
          type: 'sale',
          payload: {},
          attempts: 3,
          nextAttemptAt: '2999-01-01T00:00:00.000Z',
        },
      ],
      isSyncing: false,
    });

    const before = Date.now();
    useOfflineStore.getState().retrySoon();

    const item = useOfflineStore.getState().queue[0];
    // Pulled in to the next second or so, not to zero -- see the retrySoon
    // block below for why the difference matters across a shop full of tills.
    expect(Date.parse(item.nextAttemptAt as string) - before).toBeLessThan(2_000);
    expect(item.attempts).toBe(3);
  });
});

describe('offlineStore - review and eligibility predicates', () => {
  const healthy = {
    type: 'sale',
    payload: {},
    contractVersion: SALE_QUEUE_CONTRACT_VERSION,
  };

  it('treats legacy, mismatched and parked entries as needing review', () => {
    expect(needsReview({ type: 'sale', payload: {} })).toBe(true);
    expect(needsReview({ ...healthy, mismatched: true })).toBe(true);
    expect(needsReview({ ...healthy, syncFailed: true })).toBe(true);
    expect(needsReview(healthy)).toBe(false);
  });

  it('does not widen isQuarantined to cover a parked entry', () => {
    expect(isQuarantined({ ...healthy, syncFailed: true })).toBe(false);
  });

  it('treats an entry with no retry state as due now and eligible', () => {
    expect(isDue(healthy)).toBe(true);
    expect(isEligible(healthy)).toBe(true);
  });

  it('holds an entry back until its nextAttemptAt', () => {
    const item = { ...healthy, attempts: 1, nextAttemptAt: '2999-01-01T00:00:00.000Z' };
    expect(isDue(item)).toBe(false);
    expect(isEligible(item)).toBe(false);
    expect(isDue(item, Date.parse('2999-01-01T00:00:00.000Z'))).toBe(true);
  });

  it('reports no next sweep at all when every entry needs review', () => {
    expect(
      earliestAttemptAt([
        { id: 'a', createdAt: '', type: 'sale', payload: {} },
        { id: 'b', createdAt: '', ...healthy, syncFailed: true },
      ])
    ).toBeNull();
    expect(earliestAttemptAt([])).toBeNull();
  });

  it('reports the earliest eligible entry as the next sweep', () => {
    const at = earliestAttemptAt([
      { id: 'a', createdAt: '', ...healthy, nextAttemptAt: '2999-01-02T00:00:00.000Z' },
      { id: 'b', createdAt: '', ...healthy, nextAttemptAt: '2999-01-01T00:00:00.000Z' },
      { id: 'c', createdAt: '', ...healthy, syncFailed: true },
    ]);
    expect(at).toBe(Date.parse('2999-01-01T00:00:00.000Z'));
  });

  it('reports a sweep due now when any entry carries no backoff', () => {
    const at = earliestAttemptAt([
      { id: 'a', createdAt: '', ...healthy, nextAttemptAt: '2999-01-01T00:00:00.000Z' },
      { id: 'b', createdAt: '', ...healthy },
    ]);
    expect(at).toBe(0);
  });

  it('counts parked entries separately from quarantined ones', () => {
    useOfflineStore.setState({
      queue: [
        { id: 'a', createdAt: '', type: 'sale', payload: {} }, // legacy, quarantined
        { id: 'b', createdAt: '', ...healthy, syncFailed: true }, // parked
        { id: 'c', createdAt: '', ...healthy }, // healthy
      ],
      isSyncing: false,
    });

    expect(useOfflineStore.getState().getQuarantinedCount()).toBe(1);
    expect(useOfflineStore.getState().queue.filter(isParked)).toHaveLength(1);
  });
});

describe('offlineStore - isSyncing is not persisted', () => {
  it('writes no isSyncing key to storage', () => {
    useOfflineStore.setState({ isSyncing: true });
    useOfflineStore.getState().addToQueue({ type: 'sale', payload: {} });

    const persisted = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) as string);
    expect(persisted.state).not.toHaveProperty('isSyncing');
  });

  it('rehydrates a blob written by a tab killed mid-sync as not syncing', async () => {
    // What a pre-partialize build left behind: syncQueue early-returns on
    // isSyncing, so without the reset this queue never syncs again.
    localStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify({
        state: { queue: [{ id: 'a', createdAt: '', type: 'sale', payload: {} }], isSyncing: true },
        version: 0,
      })
    );

    await useOfflineStore.persist.rehydrate();

    expect(useOfflineStore.getState().isSyncing).toBe(false);
    expect(useOfflineStore.getState().queue).toHaveLength(1);
  });
});

describe('offlineStore - retry state persistence', () => {
  it('survives a persist round-trip', async () => {
    useOfflineStore.getState().addToQueue({ type: 'sale', payload: {} });
    const id = useOfflineStore.getState().queue[0].id;
    useOfflineStore.getState().recordFailure(id, { retryable: true, reason: 'server-error' });
    const before = useOfflineStore.getState().queue[0];
    const raw = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY) as string;

    useOfflineStore.setState({ queue: [], isSyncing: false });
    localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, raw);
    await useOfflineStore.persist.rehydrate();

    expect(useOfflineStore.getState().queue[0]).toEqual(before);
  });
});

describe('offlineStore - legacy id migration', () => {
  it('restamps every numeric id so pre-upgrade entries stop colliding', () => {
    // Two sales rung up in the same millisecond before the upgrade: the whole
    // defect, preserved verbatim in a real cashier's localStorage.
    const collided = migrateQueueIds([
      { id: 1738000000000, createdAt: '', type: 'sale', payload: { n: 1 } },
      { id: 1738000000000, createdAt: '', type: 'sale', payload: { n: 2 } },
    ]);

    expect(collided[0].id).not.toBe(collided[1].id);
    expect(typeof collided[0].id).toBe('string');
    // Payloads are untouched -- this restamps identity, nothing else.
    expect(collided.map((item) => item.payload)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('leaves an already-migrated string id alone', () => {
    const migrated = migrateQueueIds([
      { id: 'already-opaque', createdAt: '', type: 'sale', payload: {} },
    ]);

    expect(migrated[0].id).toBe('already-opaque');
  });

  it('runs on rehydrate, so a collided queue is repaired before anything reads it', async () => {
    localStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify({
        state: {
          queue: [
            { id: 1738000000000, createdAt: '', type: 'sale', payload: { n: 1 } },
            { id: 1738000000000, createdAt: '', type: 'sale', payload: { n: 2 } },
          ],
        },
        version: 0,
      })
    );

    await useOfflineStore.persist.rehydrate();

    const [first, second] = useOfflineStore.getState().queue;
    expect(first.id).not.toBe(second.id);

    // The behaviour that mattered: removing one no longer deletes the other.
    useOfflineStore.getState().removeFromQueue(first.id);
    expect(useOfflineStore.getState().queue).toHaveLength(1);
    expect(useOfflineStore.getState().queue[0].payload).toEqual({ n: 2 });
  });
});

describe('offlineStore - rate-limit backoff floor', () => {
  it('honours a failure that carries its own minimum delay', () => {
    // The classifier returns minDelayMs for a 429. If recordFailure ignored
    // it, a till would retry a rate limiter on the 1s base step and earn a
    // longer ban -- and nothing downstream would notice.
    useOfflineStore.getState().addToQueue({ type: 'sale', payload: {} });
    const id = useOfflineStore.getState().queue[0].id;
    const before = Date.now();

    useOfflineStore
      .getState()
      .recordFailure(id, { retryable: true, reason: 'rate-limited', minDelayMs: RETRY_CEILING_MS });

    const delay = Date.parse(useOfflineStore.getState().queue[0].nextAttemptAt as string) - before;
    // Jittered, but never back down at the base step.
    expect(delay).toBeGreaterThanOrEqual(Math.floor(RETRY_CEILING_MS * (1 - RETRY_JITTER)) - 5);
  });

  it('applies the floor through nextAttemptDelay itself', () => {
    for (let sample = 0; sample < 50; sample++) {
      expect(nextAttemptDelay(1, RETRY_CEILING_MS)).toBeGreaterThanOrEqual(
        Math.floor(RETRY_CEILING_MS * (1 - RETRY_JITTER))
      );
    }
  });
});

describe('offlineStore - retrySoon', () => {
  it('pulls a pending backoff in without dropping it to zero', () => {
    // Dropping to zero would put every till in the shop on the same instant --
    // the lockstep stampede the jitter exists to break.
    useOfflineStore.setState({
      queue: [
        {
          id: 'a',
          createdAt: '',
          type: 'sale',
          payload: {},
          attempts: 5,
          nextAttemptAt: new Date(Date.now() + RETRY_CEILING_MS).toISOString(),
        },
      ],
      isSyncing: false,
    });

    const before = Date.now();
    useOfflineStore.getState().retrySoon();

    const item = useOfflineStore.getState().queue[0];
    const delay = Date.parse(item.nextAttemptAt as string) - before;
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(Math.ceil(RETRY_BASE_MS * (1 + RETRY_JITTER)) + 5);
    // Reconnecting is not a free pass for a sale the server keeps rejecting.
    expect(item.attempts).toBe(5);
  });

  it('leaves an already-due entry exactly as it is', () => {
    useOfflineStore.setState({
      queue: [{ id: 'a', createdAt: '', type: 'sale', payload: {}, attempts: 2 }],
      isSyncing: false,
    });
    const before = useOfflineStore.getState().queue[0];

    useOfflineStore.getState().retrySoon();

    expect(useOfflineStore.getState().queue[0]).toEqual(before);
  });
});

describe('offlineStore - corrupt nextAttemptAt', () => {
  it('treats an unparseable timestamp as due now rather than stranding the entry', () => {
    // A NaN compares false against everything, so a corrupt localStorage value
    // would otherwise make the entry never due, never parked and never
    // quarantined -- invisible in every banner and replayed by nothing.
    const corrupt = { type: 'sale', payload: {}, nextAttemptAt: 'not-a-date' };

    expect(isDue(corrupt)).toBe(true);
    expect(earliestAttemptAt([{ id: 'a', createdAt: '', ...corrupt, contractVersion: 'v1' }])).toBe(
      0
    );
  });

  it('does not let one corrupt entry poison the whole scheduler scalar', () => {
    const at = earliestAttemptAt([
      {
        id: 'a',
        createdAt: '',
        type: 'sale',
        payload: {},
        contractVersion: 'v1',
        nextAttemptAt: 'garbage',
      },
      {
        id: 'b',
        createdAt: '',
        type: 'sale',
        payload: {},
        contractVersion: 'v1',
        nextAttemptAt: '2999-01-01T00:00:00.000Z',
      },
    ]);

    expect(at).toBe(0);
  });
});
