import { describe, it, expect, vi } from 'vitest';
import type { AuthUser } from '../../types';

const USER: AuthUser = { id: 1, name: 'Sarah', email: 'sarah@moon.com', role: 'Cashier' };

// `client.ts` is the real HTTP adapter, so the only seam under test is axios
// itself. The mock instance below stands in for `axios.create(...)`'s
// return value and records the interceptor callbacks `client.ts` registers,
// so tests can drive the request/response pipeline directly without a
// network layer.
const mocks = vi.hoisted(() => {
  const instance = vi.fn() as unknown as ReturnType<typeof vi.fn> & {
    interceptors: {
      request: { use: (fulfilled: unknown, rejected: unknown) => void };
      response: { use: (fulfilled: unknown, rejected: unknown) => void };
    };
  };
  const handlers: {
    reqFulfilled?: (config: unknown) => unknown;
    resRejected?: (error: unknown) => unknown;
  } = {};
  instance.interceptors = {
    request: {
      use: (fulfilled, _rejected) => {
        handlers.reqFulfilled = fulfilled as (config: unknown) => unknown;
      },
    },
    response: {
      use: (_fulfilled, rejected) => {
        handlers.resRejected = rejected as (error: unknown) => unknown;
      },
    },
  };
  return {
    instance,
    handlers,
    post: vi.fn(),
    create: vi.fn(() => instance),
  };
});

vi.mock('axios', () => ({
  default: {
    create: mocks.create,
    post: mocks.post,
  },
}));

/** Fresh module graph per test: a clean `isRefreshing`/`failedQueue` closure and an uninstalled port. */
async function loadClient() {
  vi.resetModules();
  mocks.instance.mockReset();
  mocks.post.mockReset();
  const authPort = await import('./authPort');
  await import('./client');
  return authPort;
}

function make401Error(overrides: Record<string, unknown> = {}) {
  return {
    response: { status: 401 },
    config: { headers: {}, ...overrides },
  };
}

describe('transport client', () => {
  it('attaches Authorization when the installed port has a token', async () => {
    const { setAuthPort } = await loadClient();
    setAuthPort({
      getAccessToken: () => 'abc123',
      onTokenRefreshed: vi.fn(),
      onAuthFailure: vi.fn(),
    });

    const config = mocks.handlers.reqFulfilled!({ headers: {} }) as {
      headers: { Authorization?: string };
    };

    expect(config.headers.Authorization).toBe('Bearer abc123');
  });

  it('sends no Authorization header with the inert default port (none installed)', async () => {
    await loadClient();

    const config = mocks.handlers.reqFulfilled!({ headers: {} }) as {
      headers: { Authorization?: string };
    };

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('sends no Authorization header when getAccessToken returns null', async () => {
    const { setAuthPort } = await loadClient();
    setAuthPort({ getAccessToken: () => null, onTokenRefreshed: vi.fn(), onAuthFailure: vi.fn() });

    const config = mocks.handlers.reqFulfilled!({ headers: {} }) as {
      headers: { Authorization?: string };
    };

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('on a 401, refreshes, calls onTokenRefreshed once, and retries with the new token', async () => {
    const { setAuthPort } = await loadClient();
    const onTokenRefreshed = vi.fn();
    setAuthPort({ getAccessToken: () => 'stale', onTokenRefreshed, onAuthFailure: vi.fn() });

    mocks.post.mockResolvedValue({ data: { data: { accessToken: 'fresh', user: USER } } });
    mocks.instance.mockResolvedValue('retried-response');

    const result = await mocks.handlers.resRejected!(make401Error());

    expect(onTokenRefreshed).toHaveBeenCalledExactlyOnceWith(USER, 'fresh');
    expect(mocks.instance).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        _retry: true,
        headers: expect.objectContaining({ Authorization: 'Bearer fresh' }),
      })
    );
    expect(result).toBe('retried-response');
  });

  it('on a failed refresh, calls onAuthFailure once and rejects with the refresh error', async () => {
    const { setAuthPort } = await loadClient();
    const onAuthFailure = vi.fn();
    setAuthPort({ getAccessToken: () => 'stale', onTokenRefreshed: vi.fn(), onAuthFailure });

    const refreshError = new Error('refresh failed');
    mocks.post.mockRejectedValue(refreshError);

    await expect(mocks.handlers.resRejected!(make401Error())).rejects.toBe(refreshError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('dedupes two concurrent 401s into a single refresh call', async () => {
    const { setAuthPort } = await loadClient();
    setAuthPort({
      getAccessToken: () => 'stale',
      onTokenRefreshed: vi.fn(),
      onAuthFailure: vi.fn(),
    });

    let resolveRefresh!: (value: unknown) => void;
    mocks.post.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );
    mocks.instance.mockResolvedValue('retried');

    const first = mocks.handlers.resRejected!(make401Error());
    const second = mocks.handlers.resRejected!(make401Error());

    resolveRefresh({ data: { data: { accessToken: 'fresh', user: USER } } });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(firstResult).toBe('retried');
    expect(secondResult).toBe('retried');
  });

  it('does not attempt a second refresh for a request already marked _retry', async () => {
    const { setAuthPort } = await loadClient();
    const onAuthFailure = vi.fn();
    setAuthPort({ getAccessToken: () => 'stale', onTokenRefreshed: vi.fn(), onAuthFailure });

    const error = make401Error({ _retry: true });

    await expect(mocks.handlers.resRejected!(error)).rejects.toBe(error);

    expect(mocks.post).not.toHaveBeenCalled();
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('imports nothing from the store directory (structural check — the R16 edge this unit removes)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, 'client.ts'), 'utf-8');

    expect(source).not.toContain("'../../store");
  });
});
