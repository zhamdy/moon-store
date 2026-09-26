import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVER_DEADLINE_MS, apiFetch } from './client';
import { ApiError } from './errors';

function jsonResponse(status: number, body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // A developer's shell or .env.local must not change which branch these tests take.
    vi.stubEnv('API_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('unwraps a { data, meta } envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: { id: 1 }, meta: { total: 1 } }));

    const result = await apiFetch<{ id: number }>('/ping');

    expect(result).toEqual({ data: { id: 1 }, meta: { total: 1 } });
  });

  it('unwraps a { data }-only envelope, as the server sends when there is no meta', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: { id: 1 } }));

    const result = await apiFetch<{ id: number }>('/ping');

    expect(result).toEqual({ data: { id: 1 } });
  });

  it('sends a GET to the server base URL with Accept, no body and credentials omit (server, dev)', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: null }));

    await apiFetch('/ping');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/v1/ping');
    expect(init?.method).toBe('GET');
    expect((init?.headers as Record<string, string>).Accept).toBe('application/json');
    expect(init?.body).toBeUndefined();
    expect(init?.credentials).toBe('omit');
  });

  it('serialises an object body as JSON with Content-Type, and forwards credentials: include', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: null }));

    await apiFetch('/cart', {
      method: 'POST',
      body: { qty: 2 },
      credentials: 'include',
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init?.body).toBe(JSON.stringify({ qty: 2 }));
    expect(init?.credentials).toBe('include');
  });

  it('resolves API_URL with no double slash (server)', async () => {
    vi.stubEnv('API_URL', 'https://api.example.com/');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: null }));

    await apiFetch('/x');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/x');
  });

  it('returns { data: undefined } for a 204 without parsing the body', async () => {
    const response = new Response(null, { status: 204 });
    const jsonSpy = vi.spyOn(response, 'json');
    vi.mocked(fetch).mockResolvedValue(response);

    const result = await apiFetch('/x');

    expect(result).toEqual({ data: undefined });
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('throws ApiError for a 400 validation error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ field: 'email', code: 'invalid_string', message: 'Invalid email' }],
        },
      })
    );

    await expect(apiFetch('/x')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: [{ field: 'email', code: 'invalid_string', message: 'Invalid email' }],
    });
  });

  it('throws ApiError with code UNAUTHORIZED for a 401', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
    );

    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
  });

  it('throws ApiError INVALID_RESPONSE for a 502 with an HTML body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html>Bad gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it.each([
    ['no error field', { message: 'Internal' }],
    ['a non-string error code', { error: { code: 1 } }],
  ])('throws ApiError INVALID_RESPONSE for a 500 whose JSON body has %s', async (_, body) => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(500, body));

    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 500 });
  });

  it('throws ApiError NETWORK_ERROR with status 0 and the original error as cause when fetch rejects', async () => {
    const original = new TypeError('Failed to fetch');
    vi.mocked(fetch).mockRejectedValue(original);

    const caught: unknown = await apiFetch('/x').catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('NETWORK_ERROR');
    expect((caught as ApiError).status).toBe(0);
    expect((caught as ApiError).cause).toBe(original);
  });

  it('throws ApiError INVALID_RESPONSE when a 200 has no data field', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { meta: { total: 0 } }));

    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });

  describe('abort and timeout', () => {
    // A fetch that never settles on its own, only when its signal aborts — as real fetch does.
    function hangingFetch() {
      vi.mocked(fetch).mockImplementation(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
          })
      );
    }

    it('applies the default timeout in the browser with no caller signal', async () => {
      vi.stubGlobal('window', {});
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: null }));

      await apiFetch('/x');

      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
    });

    it('passes no signal on the server by default, keeping Next fetch memoization', async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: null }));

      await apiFetch('/x');

      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(init?.signal).toBeUndefined();
    });

    it('throws ApiError TIMEOUT with status 0 when the timeout elapses', async () => {
      hangingFetch();

      const caught: unknown = await apiFetch('/x', { timeoutMs: 5 }).catch(
        (error: unknown) => error
      );

      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).code).toBe('TIMEOUT');
      expect((caught as ApiError).status).toBe(0);
    });

    it('rethrows the original cause unchanged when the caller aborts', async () => {
      hangingFetch();
      const controller = new AbortController();
      const reason = new DOMException('The operation was aborted.', 'AbortError');

      const pending = apiFetch('/x', { signal: controller.signal }).catch(
        (error: unknown) => error
      );
      controller.abort(reason);
      const caught = await pending;

      expect(caught).toBe(reason);
      expect(caught).not.toBeInstanceOf(ApiError);
    });

    it('still reports TIMEOUT, not the caller abort, when a caller signal is given but never aborts', async () => {
      hangingFetch();
      const controller = new AbortController();

      await expect(
        apiFetch('/x', { signal: controller.signal, timeoutMs: 5 })
      ).rejects.toMatchObject({ code: 'TIMEOUT', status: 0 });
    });

    // Next strips the signal when it refetches a stale data-cache entry, so a fetch can
    // hang with no way to abort it. The server deadline is a race, not a signal.
    describe('the server deadline', () => {
      // A fetch that never settles and ignores any signal it is given.
      function deafFetch() {
        vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}));
      }

      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('bounds a server read that passes no signal, keeping memoization', async () => {
        deafFetch();

        const pending = apiFetch('/x').catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(SERVER_DEADLINE_MS);
        const caught = await pending;

        expect(caught).toBeInstanceOf(ApiError);
        expect(caught).toMatchObject({ code: 'TIMEOUT', status: 0 });
        const [, init] = vi.mocked(fetch).mock.calls[0];
        expect(init?.signal).toBeUndefined();
      });

      it('holds when the fetch ignores an explicit timeoutMs signal', async () => {
        deafFetch();

        const pending = apiFetch('/x', { timeoutMs: 5_000 }).catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(5_000);

        await expect(pending).resolves.toMatchObject({ code: 'TIMEOUT', status: 0 });
      });

      it('does not fire before the deadline', async () => {
        deafFetch();
        let settled = false;
        const pending = apiFetch('/x').then(
          () => (settled = true),
          () => (settled = true)
        );

        await vi.advanceTimersByTimeAsync(SERVER_DEADLINE_MS - 1);
        expect(settled).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        await pending;
        expect(settled).toBe(true);
      });

      it('bounds the body read too', async () => {
        vi.mocked(fetch).mockResolvedValue({
          status: 200,
          ok: true,
          json: () => new Promise<never>(() => {}),
        } as unknown as Response);

        const pending = apiFetch('/x').catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(SERVER_DEADLINE_MS);

        await expect(pending).resolves.toMatchObject({ code: 'TIMEOUT', status: 0 });
      });
    });
  });

  describe('server, production', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('throws naming API_URL and never calls fetch when API_URL is unset', async () => {
      await expect(apiFetch('/x')).rejects.toThrow(/API_URL/);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('browser, production', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {});
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('logs console.error naming NEXT_PUBLIC_API_URL and falls back to same-origin', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { data: null }));

      await apiFetch('/x');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_API_URL'));
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe('/api/v1/x');

      consoleSpy.mockRestore();
    });
  });
});
