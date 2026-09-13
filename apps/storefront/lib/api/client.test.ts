import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('unwraps a success envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(200, { success: true, data: { id: 1 }, meta: { total: 1 } })
    );

    const result = await apiFetch<{ id: number }>('/ping');

    expect(result).toEqual({ data: { id: 1 }, meta: { total: 1 } });
  });

  it('sends a GET to the server base URL with Accept, no body and credentials omit (server, dev)', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { success: true, data: null }));

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
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { success: true, data: null }));

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
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { success: true, data: null }));

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
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { success: true }));

    await expect(apiFetch('/x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
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
      vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { success: true, data: null }));

      await apiFetch('/x');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_API_URL'));
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe('/api/v1/x');

      consoleSpy.mockRestore();
    });
  });
});
