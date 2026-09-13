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
  authRateLimitMax,
  createGlobalLimiter,
  globalRateLimitMax,
  logRateLimitOverrides,
  logTrustProxyOverride,
  isRateLimitExempt,
  rateLimitKey,
  resolveCeiling,
  resolveTrustProxy,
  trustProxySetting,
} from '../../src/http/rateLimits';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HEALTH_PATHS } from '../../src/observability/probePaths';

const ENV_KEYS = ['RATE_LIMIT_MAX', 'AUTH_RATE_LIMIT_MAX', 'TRUST_PROXY'] as const;
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

/**
 * The global limiter with per-user keying, over both a normal route and the exempt
 * health route, under a given `trust proxy` setting.
 */
async function keyedHarness(): Promise<Harness> {
  const counter = { n: 0 };
  return serve((app) => {
    app.set('trust proxy', trustProxySetting());
    app.use(createGlobalLimiter());
    const handler = (_req: express.Request, res: express.Response) => {
      counter.n += 1;
      res.json({ ok: true });
    };
    app.get('/ping', handler);
    for (const path of HEALTH_PATHS) app.get(path, handler);
  }, counter);
}

function bearer(userId: number | string): Record<string, string> {
  const token = jwt.sign(
    { id: userId, email: `u${userId}@moon.com`, role: 'Cashier', name: `User ${userId}` },
    process.env.JWT_SECRET as string
  );
  return { authorization: `Bearer ${token}` };
}

async function hit(
  url: string,
  method: 'GET' | 'POST' = 'GET',
  headers: Record<string, string> = {}
): Promise<Response> {
  return fetch(url, { method, headers });
}

async function hitMany(
  url: string,
  times: number,
  method: 'GET' | 'POST' = 'GET',
  headers: Record<string, string> = {}
) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await hit(url, method, headers)).status);
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

      // The credential path has its own message. Asserting it here is what would fail if
      // the two factories were ever collapsed into one parameterized helper.
      expect(await over.json()).toEqual({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many login attempts, please try again later',
        },
      });
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

  it('does NOT relax the global limiter — separation holds in both directions', async () => {
    // The mirror of the test above. A resolver bug where `globalRateLimitMax()` read
    // AUTH_RATE_LIMIT_MAX — a plausible copy-paste in a two-line function — would
    // silently raise the global abuse ceiling with every other test still green.
    process.env.AUTH_RATE_LIMIT_MAX = '100000';
    resetEnvCache();
    expect(globalRateLimitMax()).toBe(DEFAULT_RATE_LIMIT_MAX);
    expect(authRateLimitMax()).toBe(100000);
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

describe('production wiring', () => {
  /**
   * The tests above prove the factories. This one proves they are actually *mounted* —
   * which is the change under review. Without it, reverting `auth/routes.ts` to an inline
   * `rateLimit({ max: 10 })` would leave the whole file green while the env knob the E2E
   * suite depends on silently stopped working.
   */
  it('the real auth router rate-limits /login and /refresh through the env-driven ceiling', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    resetEnvCache();

    // Imported after the env is set: the router builds its limiter at module scope.
    const { default: authRouter } = await import('../../src/modules/core/auth/routes');

    const counter = { n: 0 };
    const h = await serve((app) => {
      app.use('/api/v1/auth', authRouter);
      // A route past the router, to prove a limited request never reaches a handler.
      app.post('/api/v1/auth/login', (_req, res) => {
        counter.n += 1;
        res.json({ ok: true });
      });
    }, counter);

    try {
      // The controller rejects these bodies, but the limiter sits ahead of it and counts
      // every attempt — which is exactly the brute-force property being asserted.
      const statuses = await hitMany(`${h.url}/api/v1/auth/login`, 3, 'POST');
      expect(statuses).not.toContain(429);

      const overLogin = await hit(`${h.url}/api/v1/auth/login`, 'POST');
      expect(overLogin.status).toBe(429);

      // The budget is shared with /refresh, on the real router's own mounting.
      const overRefresh = await hit(`${h.url}/api/v1/auth/refresh`, 'POST');
      expect(overRefresh.status).toBe(429);
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

  it('warns that an unparseable override was ignored', () => {
    // The quiet failure: without this, a typo produces a boot log identical to an unset
    // server, and the ceiling the operator thought they set never applies.
    process.env.AUTH_RATE_LIMIT_MAX = '1O';
    resetEnvCache();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRateLimitOverrides();

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('AUTH_RATE_LIMIT_MAX');
    expect(message).toMatch(/ignored/i);
  });

  it('does not warn when a variable is explicitly set to its default', () => {
    process.env.RATE_LIMIT_MAX = String(DEFAULT_RATE_LIMIT_MAX);
    resetEnvCache();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRateLimitOverrides();
    expect(warn).not.toHaveBeenCalled();
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

/**
 * Per-till keying — the fix for #63.
 *
 * An IP-keyed global budget is a *per shop* budget: several tills behind one NAT share
 * 200 requests / 15 min, and the failure lands as a `RATE_LIMITED` mid-checkout on
 * whichever cashier happens to be next. The bucket is therefore the authenticated user.
 *
 * The limiter runs before `verifyToken`, so the identity has to come from the token
 * itself — and it must be a *verified* signature. The spoofing tests below are the ones
 * that matter: an unverified `jwt.decode` would let anyone pick their own bucket, which
 * is strictly worse than the IP keying being replaced.
 */
describe('per-user keying', () => {
  it('gives two authenticated users separate budgets from the same IP', async () => {
    process.env.RATE_LIMIT_MAX = '3';
    resetEnvCache();

    const h = await keyedHarness();
    try {
      // Both tills call from 127.0.0.1 — the NAT case from the issue.
      expect(await hitMany(`${h.url}/ping`, 3, 'GET', bearer(1))).toEqual([200, 200, 200]);
      expect((await hit(`${h.url}/ping`, 'GET', bearer(1))).status).toBe(429);

      // User 2's budget is untouched by user 1 exhausting theirs.
      expect(await hitMany(`${h.url}/ping`, 3, 'GET', bearer(2))).toEqual([200, 200, 200]);
      expect((await hit(`${h.url}/ping`, 'GET', bearer(2))).status).toBe(429);
    } finally {
      await h.close();
    }
  });

  it('keeps one user in one bucket across separate tokens for the same id', async () => {
    // A till that refreshes its access token mid-shift gets a different token string but
    // the same identity; a token-keyed bucket would hand it a fresh budget on every
    // refresh and make the ceiling meaningless.
    process.env.RATE_LIMIT_MAX = '2';
    resetEnvCache();

    const h = await keyedHarness();
    try {
      await hitMany(`${h.url}/ping`, 2, 'GET', bearer(7));
      expect((await hit(`${h.url}/ping`, 'GET', bearer(7))).status).toBe(429);
    } finally {
      await h.close();
    }
  });

  it('falls back to the IP bucket for unauthenticated requests', async () => {
    process.env.RATE_LIMIT_MAX = '2';
    resetEnvCache();

    const h = await keyedHarness();
    try {
      expect(await hitMany(`${h.url}/ping`, 2)).toEqual([200, 200]);
      expect((await hit(`${h.url}/ping`)).status).toBe(429);

      // And an authenticated till is not caught by the anonymous bucket being spent.
      expect((await hit(`${h.url}/ping`, 'GET', bearer(3))).status).toBe(200);
    } finally {
      await h.close();
    }
  });

  it('does not let a forged token buy a fresh bucket', async () => {
    // The whole security of the scheme. A token signed with the wrong secret is treated
    // as anonymous, so it lands in the caller's IP bucket rather than one of its choosing.
    process.env.RATE_LIMIT_MAX = '2';
    resetEnvCache();

    const forged = jwt.sign({ id: 99, role: 'Admin' }, 'not-the-real-signing-secret-at-all');
    const h = await keyedHarness();
    try {
      await hitMany(`${h.url}/ping`, 2, 'GET', { authorization: `Bearer ${forged}` });

      // A second forged token claiming a different id is still the same IP bucket.
      const other = jwt.sign({ id: 1234 }, 'not-the-real-signing-secret-at-all');
      const over = await hit(`${h.url}/ping`, 'GET', { authorization: `Bearer ${other}` });
      expect(over.status).toBe(429);
    } finally {
      await h.close();
    }
  });

  it('treats an expired token as anonymous rather than as its claimed user', () => {
    const expired = jwt.sign({ id: 5 }, process.env.JWT_SECRET as string, { expiresIn: '-1s' });
    expect(rateLimitKey({ headers: { authorization: `Bearer ${expired}` }, ip: '10.0.0.9' })).toBe(
      'ip:10.0.0.9'
    );
  });

  it.each([
    ['no header', {}],
    ['a non-bearer scheme', { authorization: 'Basic abc' }],
    ['an empty bearer', { authorization: 'Bearer ' }],
    ['a garbage token', { authorization: 'Bearer not-a-jwt' }],
  ])('keys %s by IP', (_label, headers) => {
    expect(rateLimitKey({ headers: headers as never, ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });

  it('keys a validly signed token by its user id', () => {
    const token = jwt.sign({ id: 42 }, process.env.JWT_SECRET as string);
    expect(rateLimitKey({ headers: { authorization: `Bearer ${token}` }, ip: '10.0.0.1' })).toBe(
      'user:42'
    );
  });

  it('falls back to IP for a signed token carrying no usable id', () => {
    // A valid signature is not by itself an identity: without an `id` there is nothing to
    // bucket on, and `user:undefined` would be one shared bucket for all such callers.
    const token = jwt.sign({ role: 'Admin' }, process.env.JWT_SECRET as string);
    expect(rateLimitKey({ headers: { authorization: `Bearer ${token}` }, ip: '10.0.0.2' })).toBe(
      'ip:10.0.0.2'
    );
  });
});

describe('trust proxy', () => {
  it('defaults to off, reproducing today’s behaviour exactly', () => {
    expect(resolveTrustProxy(undefined)).toBe(false);
    expect(trustProxySetting()).toBe(false);
  });

  it.each([
    ['false', false],
    ['', false],
    ['  ', false],
    ['true', true],
    ['1', 1],
    ['2', 2],
  ])('resolves %j to %j', (raw, expected) => {
    expect(resolveTrustProxy(raw as string)).toEqual(expected);
  });

  it('resolves an address list', () => {
    expect(resolveTrustProxy('10.0.0.1, 192.168.0.0/16, loopback')).toEqual([
      '10.0.0.1',
      '192.168.0.0/16',
      'loopback',
    ]);
  });

  it('ignores an unparseable value rather than trusting something arbitrary', () => {
    // The failure has to land closed: a typo that resolved to `true` would make every
    // IP-keyed bucket client-selectable.
    expect(resolveTrustProxy('yes please')).toBe(false);
    expect(resolveTrustProxy('all')).toBe(false);
  });

  it('does not let a spoofed X-Forwarded-For escape the IP bucket by default', async () => {
    // With TRUST_PROXY unset, `req.ip` is the socket address and the header is inert —
    // so an unauthenticated client cannot mint itself a fresh budget per request.
    process.env.RATE_LIMIT_MAX = '2';
    resetEnvCache();

    const h = await keyedHarness();
    try {
      await hit(`${h.url}/ping`, 'GET', { 'x-forwarded-for': '203.0.113.1' });
      await hit(`${h.url}/ping`, 'GET', { 'x-forwarded-for': '203.0.113.2' });
      const over = await hit(`${h.url}/ping`, 'GET', { 'x-forwarded-for': '203.0.113.3' });
      expect(over.status).toBe(429);
    } finally {
      await h.close();
    }
  });

  it('under a hop count, only the trusted hop’s entry moves the bucket', async () => {
    // TRUST_PROXY=1 trusts exactly one hop, so Express takes the address that hop
    // appended — the right-hand entry — and everything further left is whatever the
    // client chose to prepend. Those prepended entries must not create a new bucket per
    // request, which is precisely what `trust proxy: true` would have allowed.
    process.env.RATE_LIMIT_MAX = '2';
    process.env.TRUST_PROXY = '1';
    resetEnvCache();

    const h = await keyedHarness();
    try {
      const asProxied = (spoofed: string) => ({
        'x-forwarded-for': `${spoofed}, 198.51.100.7`,
      });
      await hit(`${h.url}/ping`, 'GET', asProxied('203.0.113.1'));
      await hit(`${h.url}/ping`, 'GET', asProxied('203.0.113.2'));
      const over = await hit(`${h.url}/ping`, 'GET', asProxied('203.0.113.3'));
      expect(over.status).toBe(429);
    } finally {
      await h.close();
    }
  });

  it('warns loudly about the permissive setting', () => {
    process.env.TRUST_PROXY = 'true';
    resetEnvCache();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logTrustProxyOverride();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/X-Forwarded-For/i);
  });

  it('warns that an unparseable setting was ignored', () => {
    process.env.TRUST_PROXY = 'yes';
    resetEnvCache();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logTrustProxyOverride();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/ignored/i);
  });

  it('says nothing when unset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logTrustProxyOverride();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('health check exemption', () => {
  it.each(HEALTH_PATHS)('does not spend the shop’s budget on %s', async (probePath) => {
    // Counting a probe means a shop that has spent its budget also fails its own health
    // check — monitoring reporting an outage that the monitoring caused. #45 split
    // `/api/health` into liveness and readiness; each new path has to be exempt too, or
    // the exemption silently stops applying to the probes an orchestrator actually calls.
    process.env.RATE_LIMIT_MAX = '2';
    resetEnvCache();

    const h = await keyedHarness();
    try {
      const statuses = await hitMany(`${h.url}${probePath}`, 10);
      expect(statuses.filter((s) => s !== 200)).toEqual([]);

      // …and the probe has not eaten the budget the tills need.
      expect((await hit(`${h.url}/ping`)).status).toBe(200);
    } finally {
      await h.close();
    }
  });

  it('exempts exactly the declared probe paths, on GET only', () => {
    for (const path of HEALTH_PATHS) {
      expect(isRateLimitExempt({ method: 'GET', path })).toBe(true);
      expect(isRateLimitExempt({ method: 'POST', path })).toBe(false);
    }
    expect(isRateLimitExempt({ method: 'GET', path: '/api/v1/sales' })).toBe(false);
    expect(isRateLimitExempt({ method: 'GET', path: '/api/health/extra' })).toBe(false);
    expect(isRateLimitExempt({ method: 'GET', path: '/api/health/' })).toBe(false);
  });

  it('exempts every path the server actually registers as a probe', () => {
    // The list and the predicate share one source; this pins that they still agree with
    // the routes `server/index.ts` mounts.
    const registered = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8');
    const mounted = [...registered.matchAll(/app\.get\('(\/api\/health[^']*)'/g)].map((m) => m[1]);

    expect(mounted.length).toBeGreaterThan(0);
    expect(new Set(mounted)).toEqual(new Set(HEALTH_PATHS));
    for (const path of mounted) {
      expect(isRateLimitExempt({ method: 'GET', path })).toBe(true);
    }
  });
});

/**
 * The auth limiter deliberately keeps IP keying, and this suite pins that.
 *
 * Per-user keying there would *weaken* it: an attacker guessing passwords is by
 * definition unauthenticated, so there is no verified user to key on, and keying on the
 * submitted email would hand the attacker a fresh 10-attempt budget per address they
 * try — turning a brute-force control into a rate limit on the victim rather than on the
 * attacker. IP is the only identity a credential attempt actually has.
 */
describe('auth limiter keying', () => {
  it('is not widened by a bearer token — the credential budget stays per IP', async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    resetEnvCache();

    const h = await authHarness();
    try {
      await hitMany(`${h.url}/login`, 3, 'POST');
      // A caller holding a valid token for some user is still the same credential bucket.
      const over = await hit(`${h.url}/login`, 'POST', bearer(1));
      expect(over.status).toBe(429);
    } finally {
      await h.close();
    }
  });
});
