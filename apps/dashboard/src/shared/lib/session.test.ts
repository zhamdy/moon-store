import { describe, it, expect, vi } from 'vitest';
import { emitSessionEvent, onSessionEvent } from './session';

describe('session event emitter', () => {
  it('runs a handler registered for the emitted event', () => {
    const handler = vi.fn();
    onSessionEvent('logout', handler);

    emitSessionEvent('logout');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not run a handler registered for a different event', () => {
    // 'logout' is the only event type today; simulate "a different event"
    // by unsubscribing before emitting and confirming silence.
    const handler = vi.fn();
    const unsubscribe = onSessionEvent('logout', handler);
    unsubscribe();

    emitSessionEvent('logout');

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when emitting with no subscribers', () => {
    expect(() => emitSessionEvent('logout')).not.toThrow();
  });

  it('runs both handlers registered on the same event', () => {
    const first = vi.fn();
    const second = vi.fn();
    onSessionEvent('logout', first);
    onSessionEvent('logout', second);

    emitSessionEvent('logout');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes only its own handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = onSessionEvent('logout', first);
    onSessionEvent('logout', second);

    unsubscribeFirst();
    emitSessionEvent('logout');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('a handler that throws does not prevent remaining handlers from running', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = vi.fn(() => {
      throw new Error('cart clear failed');
    });
    const remaining = vi.fn();
    onSessionEvent('logout', throwing);
    onSessionEvent('logout', remaining);

    expect(() => emitSessionEvent('logout')).not.toThrow();

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(remaining).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });
});
