/**
 * MED-2 and LOW-4, plus the guard lead L5 asked for.
 *
 * The quote is priced, per-bag data and the contract says **every status** on its path
 * carries `no-store`. That held for POST and for nothing else: an OPTIONS that `cors()`
 * does not short-circuit — no `Origin` header at all, or one the quote's CORS does not
 * allow — missed the POST handler, passed `publicCacheOnSuccess` (a `router.use`, so it
 * matches every method) and was answered by Express's built-in per-route responder with
 * `200 / Allow: POST`, shipping `public, max-age=60` on the pricing endpoint's own URL.
 *
 * Setting `no-store` earlier in the chain does not fix it: this middleware decides the
 * header at `writeHead`, so it simply rewrites whatever was set before. The guard has to
 * be the cache middleware itself, which now skips the quote path outright — see the
 * second describe for why that is also the answer to L5.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createApp } from '../../src/app';
import { publicCacheOnSuccess } from '../../middleware/cache';

const QUOTE = '/api/v1/catalog/cart/quote';

let server: Server;
let port: number;

beforeAll(async () => {
  const app = createApp();
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function send(
  method: string,
  headers: Record<string, string> = {},
  payload?: string
): Promise<{ status: number; cache: string | undefined }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: QUOTE,
        method,
        headers:
          payload === undefined
            ? headers
            : {
                'content-type': 'application/json',
                'content-length': String(Buffer.byteLength(payload)),
                ...headers,
              },
      },
      (res) => {
        res.resume();
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, cache: res.headers['cache-control'] })
        );
      }
    );
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

describe('cart quote cache headers', () => {
  it('answers POST with no-store', async () => {
    const res = await send('POST', {}, JSON.stringify({ lines: [] }));
    expect(res.cache).toBe('no-store');
  });

  /** The exact MED-2 repro: no Origin at all, so cors() does not terminate it. */
  it('answers OPTIONS with no-store rather than public, max-age', async () => {
    const res = await send('OPTIONS');
    expect(res.cache).toBe('no-store');
  });

  it('answers OPTIONS from a non-allowlisted origin with no-store', async () => {
    const res = await send('OPTIONS', { origin: 'http://localhost:5173' });
    expect(res.cache).toBe('no-store');
  });

  it.each(['GET', 'HEAD', 'PUT', 'DELETE'])('answers %s with no-store', async (method) => {
    const res = await send(method);
    expect(res.cache).toBe('no-store');
  });

  it('answers a malformed body with no-store', async () => {
    const res = await send('POST', {}, '{ not json');
    expect(res.status).toBe(400);
    expect(res.cache).toBe('no-store');
  });
});

/**
 * L5 asked whether anything pins the *ordering* that keeps the quote uncacheable, since
 * a header assertion still passes after someone moves a route below the cache middleware.
 *
 * The answer is now that ordering is not what keeps it uncacheable: `publicCacheOnSuccess`
 * skips the quote path itself, so no arrangement of the router can make per-bag pricing
 * publicly cacheable. That property is asserted here directly, against the middleware
 * rather than against a route arrangement — which is a stronger guard than the ordering
 * test would have been, and cannot be defeated by reordering.
 */
describe('publicCacheOnSuccess never rewrites the quote path (L5)', () => {
  function run(path: string, statusCode: number): string | undefined {
    let header: string | undefined;
    const res = {
      writeHead(this: unknown, _status: number, ..._rest: unknown[]) {
        return this as never;
      },
      setHeader(name: string, value: string) {
        if (name === 'Cache-Control') header = value;
      },
    } as unknown as Parameters<ReturnType<typeof publicCacheOnSuccess>>[1];

    const req = { baseUrl: '/api/v1/catalog', path } as unknown as Parameters<
      ReturnType<typeof publicCacheOnSuccess>
    >[0];

    publicCacheOnSuccess(60)(req, res, () => {});
    res.writeHead(statusCode);
    return header;
  }

  it.each([200, 204, 304, 400, 413, 429, 503])(
    'leaves the quote path alone on %i',
    (statusCode) => {
      expect(run('/cart/quote', statusCode)).toBeUndefined();
    }
  );

  it('still caches an ordinary catalog read', () => {
    expect(run('/products', 200)).toBe('public, max-age=60');
  });

  it('still sends no-store for an ordinary catalog failure', () => {
    expect(run('/products', 503)).toBe('no-store');
  });
});
