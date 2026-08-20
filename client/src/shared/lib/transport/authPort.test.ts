import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthUser } from '../../types/index';

const USER: AuthUser = {
  id: 1,
  name: 'Sarah',
  email: 'sarah@moon.com',
  role: 'Cashier',
} as AuthUser;

describe('authPort', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('defaults to no token and no-op callbacks before any port is installed', async () => {
    const { getAccessToken, onTokenRefreshed, onAuthFailure } = await import('./authPort');

    expect(getAccessToken()).toBeNull();
    expect(() => onTokenRefreshed(USER, 'token')).not.toThrow();
    expect(() => onAuthFailure()).not.toThrow();
  });

  it('delegates to the installed port', async () => {
    const { setAuthPort, getAccessToken, onTokenRefreshed, onAuthFailure } =
      await import('./authPort');
    const impl = {
      getAccessToken: vi.fn(() => 'abc123'),
      onTokenRefreshed: vi.fn(),
      onAuthFailure: vi.fn(),
    };

    setAuthPort(impl);

    expect(getAccessToken()).toBe('abc123');
    expect(impl.getAccessToken).toHaveBeenCalledTimes(1);

    onTokenRefreshed(USER, 'new-token');
    expect(impl.onTokenRefreshed).toHaveBeenCalledExactlyOnceWith(USER, 'new-token');

    onAuthFailure();
    expect(impl.onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('replacing the port with setAuthPort stops delegating to the previous one', async () => {
    const { setAuthPort, getAccessToken } = await import('./authPort');
    const first = {
      getAccessToken: vi.fn(() => 'first'),
      onTokenRefreshed: vi.fn(),
      onAuthFailure: vi.fn(),
    };
    const second = {
      getAccessToken: vi.fn(() => 'second'),
      onTokenRefreshed: vi.fn(),
      onAuthFailure: vi.fn(),
    };

    setAuthPort(first);
    setAuthPort(second);

    expect(getAccessToken()).toBe('second');
    expect(first.getAccessToken).not.toHaveBeenCalled();
  });
});
