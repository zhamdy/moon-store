import { describe, expect, it, vi } from 'vitest';
import { createToastQueue, createToasterGate, memoizeLoader } from './toast-queue';

type Log = string[];

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(options: { failLoads?: number } = {}) {
  let failures = options.failLoads ?? 0;
  const sink: Log = [];
  const rawLoad = vi.fn(async () => {
    if (failures > 0) {
      failures -= 1;
      throw new Error('chunk failed');
    }
    return sink;
  });
  const load = memoizeLoader(rawLoad);
  const gate = createToasterGate();
  const onError = vi.fn();
  const queue = createToastQueue<Log>({
    load,
    whenReady: () => {
      gate.request();
      return gate.whenReady();
    },
    isReady: gate.isReady,
    onError,
  });
  const push = (entry: string) => queue.run((log) => log.push(entry));
  return { sink, rawLoad, gate, onError, queue, push };
}

describe('createToastQueue', () => {
  it('queues calls made before ready and flushes them in order once ready', async () => {
    const { sink, gate, push } = setup();
    push('a');
    push('b');
    await settle();
    expect(sink).toEqual([]);

    gate.markReady();
    push('c');
    await settle();
    expect(sink).toEqual(['a', 'b', 'c']);
  });

  it('runs calls synchronously once loaded and ready', async () => {
    const { sink, gate, push } = setup();
    gate.markReady();
    push('first');
    await settle();
    push('second');
    expect(sink).toEqual(['first', 'second']);
  });

  it('requests the toaster on the first queued call', () => {
    const { gate, push } = setup();
    const listener = vi.fn();
    gate.onRequest(listener);
    push('a');
    expect(listener).toHaveBeenCalled();
  });

  it('invokes the loader once for many calls', async () => {
    const { rawLoad, gate, push } = setup();
    for (let i = 0; i < 20; i += 1) push(`t${i}`);
    gate.markReady();
    await settle();
    for (let i = 0; i < 5; i += 1) push(`u${i}`);
    expect(rawLoad).toHaveBeenCalledTimes(1);
  });

  it('keeps a stable-id show and its dismissal in call order', async () => {
    const { sink, gate, queue } = setup();
    queue.run((log) => log.push('show:choose-option'));
    queue.run((log) => log.push('dismiss:choose-option'));
    queue.run((log) => log.push('show:choose-option'));
    gate.markReady();
    await settle();
    expect(sink).toEqual(['show:choose-option', 'dismiss:choose-option', 'show:choose-option']);
  });

  it('logs and drops on a failed load without throwing, and a later call retries', async () => {
    const { sink, rawLoad, gate, onError, push } = setup({ failLoads: 1 });
    gate.markReady();
    expect(() => push('lost')).not.toThrow();
    await settle();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toBe(1);
    expect(sink).toEqual([]);

    push('kept');
    await settle();
    expect(rawLoad).toHaveBeenCalledTimes(2);
    expect(sink).toEqual(['kept']);
  });

  it('queues again after the toaster unmounts, until it is ready again', async () => {
    const { sink, gate, push } = setup();
    gate.markReady();
    push('a');
    await settle();
    gate.markUnready();
    push('b');
    await settle();
    expect(sink).toEqual(['a']);
    gate.markReady();
    await settle();
    expect(sink).toEqual(['a', 'b']);
  });
});

describe('createToasterGate', () => {
  it('replays a request made before the toaster subscribed', () => {
    const gate = createToasterGate();
    gate.request();
    const listener = vi.fn();
    gate.onRequest(listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps a pending wait across an unmount that happened before ready', async () => {
    const gate = createToasterGate();
    const waited = vi.fn();
    void gate.whenReady().then(waited);
    gate.markUnready();
    gate.markReady();
    await settle();
    expect(waited).toHaveBeenCalled();
  });
});

describe('memoizeLoader', () => {
  it('shares one promise and retries after a rejection', async () => {
    let calls = 0;
    const load = memoizeLoader(async () => {
      calls += 1;
      if (calls === 1) throw new Error('once');
      return calls;
    });
    await expect(load()).rejects.toThrow('once');
    const [a, b] = await Promise.all([load(), load()]);
    expect([a, b, calls]).toEqual([2, 2, 2]);
  });
});
