/**
 * Rate-limit ceilings — env-operable, defaulting to today's production values.
 *
 * Two limiters guard this API and they guard different things: a global 200/15min on
 * every route, and a tighter 10/15min on `POST /auth/login` and `POST /auth/refresh`.
 * The E2E suite exhausts the auth budget almost immediately, so both need a test-time
 * ceiling — but folding them into one variable would mean a config written to unblock a
 * test suite silently relaxes the credential brute-force ceiling too. The tests below
 * pin that separation, and pin that an unset environment reproduces today's behavior
 * byte-for-byte.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import type { Server } from 'http';
import { AddressInfo } from 'net';
import { resetEnvCache } from '../../src/config/env';
import {
  DEFAULT_AUTH_RATE_LIMIT_MAX,
  DEFAULT_RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  createAuthLimiter,
  createGlobalLimiter,
  logRateLimitOverrides,
  resolveCeiling,
} from '../../src/http/rateLimits';

const ENV_KEYS = ['RATE_LIMIT_MAX', 'AUTH_RATE_LIMIT_MAX'] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  resetEnvCache();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  resetEnvCache();
  vi.restoreAllMocks();
});

/** Tracks how many times a request actually reached the handler behind the limiter. */
interface Harness {
  url: string;
  reached: () => number;
  close: () => Promise<void>;
}

async function serve(build: (app: Express) => void, counter: { n: number }): Promise<Harness> {
  const app = express();
  build(app);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    reached: () => counter.n,
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

/** A global limiter ahead of a counting handler, mirroring `server/index.ts`'s ordering. */
async function globalHarness(): Promise<Harness> {
  const counter = { n: 0 };
  return serve((app) => {
    app.use(createGlobalLimiter());
    app.get('/ping', (_req, res) => {
      counter.n += 1;
      res.json({ ok: true });
    });
  }, counter);
}

/** The auth limiter on the same two routes `auth/routes.ts` mounts it on. */
async function authHarness(): Promise<Harness> {
  const counter = { n: 0 };
  return serve((app) => {
    const limiter = createAuthLimiter();
    const handler = (_req: express.Request, res: express.Response) => {
      counter.n += 1;
      res.json({ ok: true });
    };
    app.post('/login', limiter, handler);
    app.post('/refresh', limiter, handler);
  }, counter);
}

async function hit(url: string, method: 'GET' | 'POST' = 'GET'): Promise<Response> {
  return fetch(url, { method });
}

async function hitMany(url: string, times: number, method: 'GET' | 'POST' = 'GET') {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await hit(url, method)).status);
  }
  return statuses;
}

describe('resolveCeiling', () => {
  it('returns the fallback when the variable is unset', () => {
    expect(resolveCeiling(undefined, 200)).toBe(200);
  });

  it('returns the parsed value for a positive integer', () => {
    expect(resolveCeiling('100000', 200)).toBe(100000);
  });

  it('falls back rather than producing NaN for a non-numeric string', () => {
    // A NaN ceiling makes express-rate-limit reject every request, which would look
    // like an outage rather than a typo.
    expect(resolveCeiling('lots', 200)).toBe(200);
    expect(resolveCeiling('', 200)).toBe(200);
    expect(resolveCeiling('  ', 200)).toBe(200);
  });

  it('treats zero and negatives as unset rather than as "block everything"', () => {
    // Decided explicitly: a ceiling of 0 is far more likely to be a mistake than an
    // intent to reject all traffic, and rejecting all traffic has no legitimate caller.
    expect(resolveCeiling('0', 200)).toBe(200);
    expect(resolveCeiling('-5', 200)).toBe(200);
  });

  it('falls back for a fractional value', () => {
    expect(resolveCeiling('12.5', 200)).toBe(200);
  });
});

describe('global limiter', () => {
  it('keeps today’s 200/15min ceiling when RATE_LIMIT_MAX is unset', async () => {
    expect(DEFAULT_RATE_LIMIT_MAX).toBe(200);
    expect(RATE_LIMIT_WINDOW_MS).toBe(15 * 60 * 1000);

    const h = await globalHarness();
    try {
      const statuses = await hitMany(`${h.url}/ping`, DEFAULT_RATE_LIMIT_MAX);
      expect(statuses.every((s) => s === 200)).toBe(true);

      const over = await hit(`${h.url}/ping`);
      expect(over.status).toBe(429);
      expect(await over.json()).toEqual({
        error: expect.objectContaining({ code: 'RATE_LIMITED' }),
      });
    } finally {
      await h.close();
    }
  }, 30_000);

  it('never reaches the handler once the ceiling is exhausted', async () => {
    process.env.RATE_LIMIT_MAX = '3';
    resetEnvCache();

    const h = await globalHarness();
    try {
      await hitMany(`${h.url}/ping`, 5);
      expect(h.reached()).toBe(3);
    } finally {
      await h.close();
    }
  });

  it('admits every request under a raised ceiling', async () => {
    process.env.RATE_LIMIT_MAX = '100000';
    resetEnvCache();

    const h = await globalHarness();
    try {
      const statuses = await hitMany(`${h.url}/ping`, 500);
      expect(statuses.filter((s) => s !== 200)).toEqual([]);
    } finally {
      await h.close();
    }
  }, 60_000);

  it('falls back to the default ceiling for a non-numeric override', async () => {
    process.env.RATE_LIMIT_MAX = 'unlimited';
    resetEnvCache();

    const h = await globalHarness();
    try {
      await hitMany(`${h.url}/ping`, 3);
      expect(h.reached()).toBe(3);
    } finally {
      await h.close();
    }
  });
});

describe('auth limiter', () => {
  it('keeps today’s 10/15min ceiling when AUTH_RATE_LIMIT_MAX is unset', async () => {
    expect(DEFAULT_AUTH_RATE_LIMIT_MAX).toBe(10);

    const h = await authHarness();
    try {
      const statuses = await hitMany(`${h.url}/login`, DEFAULT_AUTH_RATE_LIMIT_MAX, 'POST');
      expect(statuses.every((s) => s === 200)).toBe(true);

      const over = await hit(`${h.url}/login`, 'POST');
      expect(over.status).toBe(429);
      expect(h.reached()).toBe(DEFAULT_AUTH_RATE_LIMIT_MAX);
    } finally {
      await h.close();
    }
  });

  it('shares one budget across /login and /refresh', async () => {
    const h = await authHarness();
    try {
      await hitMany(`${h.url}/login`, DEFAULT_AUTH_RATE_LIMIT_MAX, 'POST');
      const refresh = await hit(`${h.url}/refresh`, 'POST');
      expect(refresh.status).toBe(429);
    } finally {
      await h.close();
    }
  });

  it('is NOT relaxed by RATE_LIMIT_MAX — the two ceilings stay separate', async () => {
    // The regression guard against a later refactor folding these into one variable:
    // unblocking a test suite must never widen the credential brute-force ceiling.
    process.env.RATE_LIMIT_MAX = '100000';
    resetEnvCache();

    const h = await authHarness();
    try {
      await hitMany(`${h.url}/login`, DEFAULT_AUTH_RATE_LIMIT_MAX, 'POST');
      const over = await hit(`${h.url}/login`, 'POST');
      expect(over.status).toBe(429);
    } finally {
      await h.close();
    }
  });

  it('honours its own raised ceiling', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '50';
    resetEnvCache();

    const h = await authHarness();
    try {
      const statuses = await hitMany(`${h.url}/login`, 25, 'POST');
      expect(statuses.filter((s) => s !== 200)).toEqual([]);
    } finally {
      await h.close();
    }
  });
});

describe('override visibility', () => {
  it('logs nothing when both ceilings are at their defaults', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRateLimitOverrides();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns with the effective ceiling when either is overridden', () => {
    process.env.RATE_LIMIT_MAX = '100000';
    resetEnvCache();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRateLimitOverrides();

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('100000');
    expect(message).toMatch(/rate limit/i);
  });

  it('warns when only the auth ceiling is overridden', () => {
    process.env.AUTH_RATE_LIMIT_MAX = '500';
    resetEnvCache();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRateLimitOverrides();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('500');
  });
});
