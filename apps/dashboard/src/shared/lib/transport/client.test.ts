import { describe, it, expect, vi } from 'vitest';
import type { AuthUser } from '../../types/index';

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

describe('HTTP transport contract', () => {
  it('unwraps paginated and aggregate metadata without exposing the envelope', async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        success: true,
        data: [{ id: 1 }],
        meta: {
          pagination: {
            page: 1,
            pageSize: 25,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          totalAmount: 42,
        },
      },
    });
    const { createHttpTransport } = await import('./http');
    const transport = createHttpTransport({ request } as never);

    await expect(transport.request({ method: 'GET', path: 'expenses' })).resolves.toEqual({
      data: [{ id: 1 }],
      meta: expect.objectContaining({ totalAmount: 42 }),
    });
  });

  it('returns undefined data for a successful 204', async () => {
    const request = vi.fn().mockResolvedValue({ status: 204, data: undefined });
    const { createHttpTransport } = await import('./http');
    const transport = createHttpTransport({ request } as never);

    await expect(
      transport.request<void>({ method: 'DELETE', path: 'expenses/1' })
    ).resolves.toEqual({
      data: undefined,
    });
  });

  it.each([
    [
      { error: 'Invalid amount' },
      { message: 'Invalid amount', code: undefined, details: undefined },
    ],
    [
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid amount',
          details: [{ field: 'amount', code: 'too_small', message: 'Must be positive' }],
        },
      },
      {
        message: 'Invalid amount',
        code: 'VALIDATION_ERROR',
        details: [{ field: 'amount', code: 'too_small', message: 'Must be positive' }],
      },
    ],
  ])('normalizes legacy and structured errors (%#)', async (body, expected) => {
    const request = vi.fn().mockRejectedValue({ response: { status: 400, data: body } });
    const { createHttpTransport } = await import('./http');
    const transport = createHttpTransport({ request } as never);

    const error = await transport
      .request({ method: 'GET', path: 'expenses' })
      .catch((caught) => caught);
    expect(error).toMatchObject({ name: 'ApiError', status: 400, ...expected });
  });

  it('keeps blob responses outside JSON envelope handling', async () => {
    const blob = new Blob(['report']);
    const request = vi.fn().mockResolvedValue({ status: 200, data: blob });
    const { createHttpTransport } = await import('./http');
    const transport = createHttpTransport({ request } as never);

    await expect(
      transport.request<Blob>({ method: 'GET', path: 'exports/1', responseType: 'blob' })
    ).resolves.toEqual({ data: blob });
  });

  it('sends an idempotency key as the Idempotency-Key header', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { data: { id: 1 } } });
    const { createHttpTransport } = await import('./http');
    const transport = createHttpTransport({ request } as never);

    await transport.request({
      method: 'POST',
      path: 'sales',
      body: { total: 10 },
      idempotencyKey: 'a1b2c3',
    });

    expect(request.mock.calls[0][0].headers).toEqual({ 'Idempotency-Key': 'a1b2c3' });
  });

  it('sends no headers at all when no key is supplied', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { data: { id: 1 } } });
    const { createHttpTransport } = await import('./http');
    const transport = createHttpTransport({ request } as never);

    await transport.request({ method: 'POST', path: 'sales', body: { total: 10 } });

    // The shared client's own JSON headers must stay in force -- an empty
    // per-request `headers` object would be harmless, but asserting its
    // absence keeps the no-key path byte-identical to pre-idempotency behaviour.
    expect(request.mock.calls[0][0]).not.toHaveProperty('headers');
  });

  it('still clears Content-Type for a FormData body, alongside a key', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: { data: {} } });
    const { createHttpTransport } = await import('./http');
    const transport = createHttpTransport({ request } as never);

    await transport.request({
      method: 'POST',
      path: 'products/import',
      body: new FormData(),
      idempotencyKey: 'k-1',
    });

    expect(request.mock.calls[0][0].headers).toEqual({
      'Content-Type': undefined,
      'Idempotency-Key': 'k-1',
    });
  });
});
