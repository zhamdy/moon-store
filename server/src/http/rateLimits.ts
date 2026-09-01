import type { Request } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env';
import { errorResponse } from './errors';
import logger from '../../lib/logger';

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Today's global ceiling. An unset `RATE_LIMIT_MAX` reproduces it exactly. */
export const DEFAULT_RATE_LIMIT_MAX = 200;

/** Today's credential ceiling on `/auth/login` and `/auth/refresh`. */
export const DEFAULT_AUTH_RATE_LIMIT_MAX = 10;

/**
 * A ceiling is only honoured when it is a positive integer. Anything else — a typo, an
 * empty string, `0`, a negative — falls back to the default rather than to `NaN`, which
 * express-rate-limit would treat as "reject everything" and which reads as an outage
 * rather than as a misconfiguration.
 */
export function resolveCeiling(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return fallback;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function globalRateLimitMax(): number {
  return resolveCeiling(getEnv().RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
}

export function authRateLimitMax(): number {
  return resolveCeiling(getEnv().AUTH_RATE_LIMIT_MAX, DEFAULT_AUTH_RATE_LIMIT_MAX);
}

/**
 * Paths the global limiter does not spend budget on.
 *
 * `/api/health` is a single `SELECT 1` behind an unauthenticated GET, and it is called
 * by uptime probes and load balancers on a fixed schedule. Counting it means a shop that
 * has spent its budget also fails its own health probe — the monitoring reports an
 * outage caused by the monitoring. The traffic it can generate is bounded by the prober,
 * and flooding an unauthenticated endpoint is a job for the layer in front of the app,
 * not for a budget that a cashier's checkout shares.
 *
 * Deliberately narrow: register/shift polling reads are *authenticated*, so per-user
 * keying already stops one till starving another. Exempting them as well would carve
 * real, DB-touching endpoints out of abuse protection for no remaining benefit.
 */
export function isRateLimitExempt(req: Pick<Request, 'method' | 'path'>): boolean {
  return req.method === 'GET' && req.path === '/api/health';
}

/**
 * The rate-limit bucket for a request.
 *
 * Keying on `req.ip` alone makes the budget per *shop*: several tills behind one NAT
 * share 200 requests / 15 min, so a busy till can push a colleague mid-checkout into a
 * `RATE_LIMITED`. Keying on the authenticated user makes the budget per till.
 *
 * The limiter runs before `verifyToken`, so `req.user` does not exist yet. The token is
 * therefore verified here — `jwt.verify`, not `jwt.decode`, against the same
 * `JWT_SECRET` the auth middleware uses. That distinction is the security of the whole
 * scheme: an unverified `decode` would let anyone mint a token claiming any `id` and so
 * *choose their own bucket*, which is strictly worse than IP keying because a single
 * attacker could then also occupy an honest user's bucket. A signature that does not
 * verify is treated exactly as no token at all.
 *
 * The alternative — moving the limiter behind the auth middleware — was rejected: the
 * limiter is mounted once at the app level and would have to be re-mounted inside every
 * router, unauthenticated routes would lose their limit entirely, and the ordering would
 * become a per-route invariant nobody can see from `index.ts`. An HMAC verify per
 * request is the cheaper price.
 */
export function rateLimitKey(req: Pick<Request, 'headers' | 'ip'>): string {
  const userId = verifiedUserId(req);
  if (userId !== undefined) return `user:${userId}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

function verifiedUserId(req: Pick<Request, 'headers'>): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined;

  const token = header.slice('Bearer '.length).trim();
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return undefined;

  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded !== 'object' || decoded === null) return undefined;
    const { id } = decoded as { id?: unknown };
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
    if (typeof id === 'string' && id.length > 0) return id;
    return undefined;
  } catch {
    // Expired, forged, or signed with another secret — indistinguishable from anonymous
    // for bucketing purposes, and the request is about to be rejected by `verifyToken`
    // anyway. Falling back to the IP bucket keeps those attempts budgeted.
    return undefined;
  }
}

/**
 * `max` is passed as a resolver rather than a number so that `getEnv()` is not called
 * while modules are still being imported.
 *
 * `auth/routes.ts` builds its limiter at module scope, and imports are hoisted above
 * `server/index.ts`'s body — so an eagerly-resolved ceiling would run the full Zod
 * environment parse before the explicit `requiredEnvVars` check, and a server missing
 * `JWT_SECRET` would die with an uncaught validation stack trace instead of the clean
 * `FATAL: Missing required environment variable` message and `exit(1)`.
 */
export function createGlobalLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: () => globalRateLimitMax(),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
    skip: isRateLimitExempt,
    message: errorResponse('RATE_LIMITED'),
  });
}

export function createAuthLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: () => authRateLimitMax(),
    standardHeaders: true,
    legacyHeaders: false,
    message: errorResponse('RATE_LIMITED', 'Too many login attempts, please try again later'),
  });
}

/**
 * Once `RATE_LIMIT_MAX=100000` exists in a workflow file it is one copy-paste from a
 * deploy environment, where a 500x-raised abuse ceiling would otherwise produce no
 * signal at all. Say so at boot — the same posture the server already takes for a
 * missing JWT secret.
 */
export function logRateLimitOverrides(): void {
  const env = getEnv();

  // An ignored value is the quieter and more dangerous case: `AUTH_RATE_LIMIT_MAX=1O`
  // (letter O) resolves to the default, so comparing effective-to-default would produce a
  // boot log byte-identical to an unset server, and the operator's intended ceiling never
  // takes effect. Say so explicitly.
  warnIfIgnored('RATE_LIMIT_MAX', env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX);
  warnIfIgnored('AUTH_RATE_LIMIT_MAX', env.AUTH_RATE_LIMIT_MAX, DEFAULT_AUTH_RATE_LIMIT_MAX);

  const global = globalRateLimitMax();
  const auth = authRateLimitMax();
  if (global === DEFAULT_RATE_LIMIT_MAX && auth === DEFAULT_AUTH_RATE_LIMIT_MAX) return;

  logger.warn(
    `Rate limit ceilings overridden: global=${global}/15min (default ${DEFAULT_RATE_LIMIT_MAX}), ` +
      `auth=${auth}/15min (default ${DEFAULT_AUTH_RATE_LIMIT_MAX}). ` +
      'Expected for test runs only.'
  );
}

/**
 * Today's `trust proxy` setting: Express's own default, i.e. off. An unset
 * `TRUST_PROXY` reproduces it exactly, so `req.ip` stays the socket address.
 */
export const DEFAULT_TRUST_PROXY = false;

/** Presets Express understands by name, alongside literal addresses and CIDR ranges. */
const TRUST_PROXY_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);

/** A literal IPv4/IPv6 address or CIDR range, loosely — Express does the real parsing. */
const ADDRESS_LIKE = /^[0-9a-fA-F.:]+(\/\d{1,3})?$/;

export type TrustProxySetting = boolean | number | string[];

/**
 * Resolves `TRUST_PROXY` into a value for `app.set('trust proxy', …)`.
 *
 * Behind a proxy every request arrives from the proxy's address, so an IP-keyed bucket
 * becomes one bucket for the entire internet. The fix is to trust the forwarding
 * headers — but only as far as they can be trusted: `trust proxy: true` accepts whatever
 * `X-Forwarded-For` the *client* sent, which lets an attacker put every request in a
 * fresh bucket and makes the IP limit decorative. So:
 *
 *   - unset / `false` → off (today's behaviour, and the safe default)
 *   - a hop count (`1`, `2`) → trust exactly that many proxies closest to the app
 *   - a comma list of addresses, CIDRs, or the `loopback`/`linklocal`/`uniquelocal`
 *     presets → trust only those
 *   - `true` → accepted because a deployment may genuinely need it, but warned about
 *   - anything else → ignored, falls back to off, and warned about
 *
 * A hop count is usually the setting to reach for: it needs no knowledge of the proxy's
 * address, and Express resolves the address from the right-hand end of the chain, so the
 * entries a client prepends are ignored — the count bounds how far into a
 * client-controlled header the resolution can reach. `true` removes that bound, which is
 * why it is warned about rather than treated as a convenience.
 */
export function resolveTrustProxy(raw: string | undefined): TrustProxySetting {
  if (raw === undefined) return DEFAULT_TRUST_PROXY;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'false') return false;
  if (trimmed.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(trimmed)) {
    const hops = Number(trimmed);
    return Number.isSafeInteger(hops) ? hops : DEFAULT_TRUST_PROXY;
  }

  const entries = trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (entries.length === 0) return DEFAULT_TRUST_PROXY;
  if (entries.every((entry) => TRUST_PROXY_PRESETS.has(entry) || ADDRESS_LIKE.test(entry))) {
    return entries;
  }
  return DEFAULT_TRUST_PROXY;
}

export function trustProxySetting(): TrustProxySetting {
  return resolveTrustProxy(getEnv().TRUST_PROXY);
}

/**
 * Boot-time visibility for the one setting here that can silently widen an attacker's
 * reach: a permissive `true` makes every IP-keyed budget spoofable, and an ignored typo
 * leaves a proxied deployment sharing one bucket for all of its traffic. Both are
 * invisible in normal operation, so both are said out loud, in the same posture as the
 * ceiling overrides above.
 */
export function logTrustProxyOverride(): void {
  const raw = getEnv().TRUST_PROXY;
  if (raw === undefined) return;

  const resolved = resolveTrustProxy(raw);

  if (resolved === true) {
    logger.warn(
      'TRUST_PROXY=true trusts the client-supplied X-Forwarded-For chain, so a client can ' +
        'choose its own rate-limit bucket. Prefer a hop count (e.g. TRUST_PROXY=1) or an ' +
        'explicit list of proxy addresses.'
    );
    return;
  }

  const normalized = raw.trim().toLowerCase();
  if (resolved === DEFAULT_TRUST_PROXY && normalized !== 'false' && normalized !== '') {
    logger.warn(
      `TRUST_PROXY="${raw}" is not a hop count, an address list, or a boolean — ignored, ` +
        'trusting no proxy. req.ip will be the proxy address if one is in front of this API.'
    );
    return;
  }

  if (resolved === DEFAULT_TRUST_PROXY) return;

  logger.warn(
    `trust proxy set to ${JSON.stringify(resolved)} from TRUST_PROXY — req.ip is taken from ` +
      'X-Forwarded-For for requests arriving through those hops.'
  );
}

function warnIfIgnored(name: string, raw: string | undefined, fallback: number): void {
  if (raw === undefined) return;
  if (resolveCeiling(raw, fallback) !== fallback) return;
  if (raw.trim() === String(fallback)) return; // Explicitly set to the default; not ignored.

  logger.warn(
    `${name}="${raw}" is not a positive integer — ignored, using the default of ${fallback}/15min.`
  );
}
