import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { getEnv, splitCatalogServerTokens } from '../config/env';
import { CART_QUOTE_PATH, CATALOG_API_PREFIX } from '../modules/commerce/catalog/constants';
import { errorResponse } from './errors';
import logger from '../../lib/logger';
import { isHealthPath } from '../observability/probePaths';

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
 * The health probes are unauthenticated GETs called by uptime probes, load balancers and
 * orchestrators on a fixed schedule. Counting them means a shop that has spent its budget
 * also fails its own health probe — the monitoring reports an outage caused by the
 * monitoring. The traffic they can generate is bounded by the prober, and flooding an
 * unauthenticated endpoint is a job for the layer in front of the app, not for a budget
 * that a cashier's checkout shares.
 *
 * The list comes from `observability/probePaths.ts` rather than being spelled out here,
 * because the failure mode of the two drifting apart is invisible: splitting `/api/health`
 * into `/live` and `/ready` while this predicate still matched one exact string would put
 * the probes back on the budget and break no test.
 *
 * Deliberately narrow: register/shift polling reads are *authenticated*, so per-user
 * keying already stops one till starving another. Exempting them as well would carve
 * real, DB-touching endpoints out of abuse protection for no remaining benefit.
 */
export function isRateLimitExempt(req: Pick<Request, 'method' | 'path'>): boolean {
  return (
    (req.method === 'GET' && isHealthPath(req.path)) || isCatalogRead(req) || isCartQuotePath(req)
  );
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `^/api/v1/catalog(/|$)`, case-insensitive, built from the constant the router mounts. */
const CATALOG_PATH = new RegExp(`^${escapeRegExp(CATALOG_API_PREFIX)}(?:/|$)`, 'i');

/**
 * Exactly the cart quote path, any method, case-insensitively and with the trailing slash
 * Express routing also accepts. Nothing below it and no sibling matches.
 */
const CART_QUOTE_PATH_PATTERN = new RegExp(`^${escapeRegExp(CART_QUOTE_PATH)}/?$`, 'i');

/**
 * The cart quote has its own edge chain in `app.ts` (plan 2026-09-15-001, CD-21): path CORS,
 * `createCartQuoteLimiter` and a 16 KB parser. The global limiter, the app-wide CORS and
 * 10 MB parser, and the catalog read limiter all skip it, so it spends exactly one budget.
 */
export function isCartQuotePath(req: Pick<Request, 'path'>): boolean {
  return CART_QUOTE_PATH_PATTERN.test(req.path);
}

/**
 * Public catalog reads leave the global budget for the catalog limiter.
 *
 * The same shared-IP problem as the tills, pointed the other way: every storefront page is
 * rendered on the Next server, so every shopper's catalog read reaches this API from one
 * address. Under the global 200/15min per-IP limit the whole site would start answering
 * 429 at modest traffic. Those reads are budgeted by `createCatalogLimiter` instead, which
 * the catalog router mounts itself.
 *
 * Case-insensitive because Express routing is: `/API/V1/Catalog/products` reaches the
 * catalog router, and a case-sensitive exemption would let it spend both budgets. Anchored
 * on `/` or end so a lookalike sibling (`/api/v1/catalogue`) is not exempt. GET and HEAD
 * only: nothing under the prefix writes, and anything else stays on the global budget.
 */
export function isCatalogRead(req: Pick<Request, 'method' | 'path'>): boolean {
  return (req.method === 'GET' || req.method === 'HEAD') && CATALOG_PATH.test(req.path);
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

/** Per-IP ceiling on public catalog reads, per 15 min. Browsers are not expected to call the API. */
export const DEFAULT_CATALOG_RATE_LIMIT_MAX = 300;

/**
 * Ceiling for the one trusted storefront-server bucket, per 15 min (~22 requests/second).
 * Every shopper's server-rendered page draws on it, softened by Next's 60s data cache.
 */
export const DEFAULT_CATALOG_SERVER_RATE_LIMIT_MAX = 20000;

export const CATALOG_SERVER_TOKEN_HEADER = 'x-catalog-server-token';

/** The key every validly-tokened request shares. Not a per-shopper limit (UD-5). */
export const CATALOG_SERVER_BUCKET = 'catalog-server';

export function catalogRateLimitMax(): number {
  return resolveCeiling(getEnv().CATALOG_RATE_LIMIT_MAX, DEFAULT_CATALOG_RATE_LIMIT_MAX);
}

export function catalogServerRateLimitMax(): number {
  return resolveCeiling(
    getEnv().CATALOG_SERVER_RATE_LIMIT_MAX,
    DEFAULT_CATALOG_SERVER_RATE_LIMIT_MAX
  );
}

let tokenDigestCache: { raw: string | undefined; digests: Buffer[] } | null = null;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function configuredTokenDigests(): Buffer[] {
  const raw = getEnv().CATALOG_SERVER_TOKEN;
  if (!tokenDigestCache || tokenDigestCache.raw !== raw) {
    tokenDigestCache = { raw, digests: splitCatalogServerTokens(raw).map(sha256) };
  }
  return tokenDigestCache.digests;
}

/**
 * Whether the request carries a configured storefront-server token.
 *
 * Both sides are hashed first, so `timingSafeEqual` always compares 32 bytes: no length
 * leak, and no throw on a wrong-length header. Every configured token is compared (no early
 * exit). A missing header, a repeated one (Node would otherwise join the copies with ", ")
 * or anything that is not exactly one string counts as no token.
 */
export function hasValidCatalogServerToken(
  req: Pick<Request, 'headers'> & { headersDistinct?: Record<string, string[] | undefined> }
): boolean {
  const digests = configuredTokenDigests();
  if (digests.length === 0) return false;

  let value: unknown;
  if (req.headersDistinct) {
    const values = req.headersDistinct[CATALOG_SERVER_TOKEN_HEADER];
    if (!Array.isArray(values) || values.length !== 1) return false;
    value = values[0];
  } else {
    value = req.headers[CATALOG_SERVER_TOKEN_HEADER];
  }
  if (typeof value !== 'string' || value.length === 0) return false;

  const presented = sha256(value);
  let matched = false;
  for (const digest of digests) {
    if (timingSafeEqual(presented, digest)) matched = true;
  }
  return matched;
}

export function catalogRateLimitKey(
  req: Pick<Request, 'headers' | 'ip'> & { headersDistinct?: Record<string, string[] | undefined> }
): string {
  if (hasValidCatalogServerToken(req)) return CATALOG_SERVER_BUCKET;
  return `ip:${req.ip ?? 'unknown'}`;
}

/**
 * The public catalog's limiter (KD-5), mounted by the catalog router itself.
 *
 * Its own store, so its `ip:` keys never meet the global limiter's. The ceiling follows
 * the key: the trusted bucket gets `CATALOG_SERVER_RATE_LIMIT_MAX`, everything else
 * `CATALOG_RATE_LIMIT_MAX` per IP. With no token configured the trusted bucket does not
 * exist and every request is per-IP -- safe for development, closed in production.
 *
 * A 429 here sets `no-store` itself: it is answered before the router's cache middleware.
 */
export function createCatalogLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: (req) =>
      hasValidCatalogServerToken(req) ? catalogServerRateLimitMax() : catalogRateLimitMax(),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: catalogRateLimitKey,
    // A non-POST request to the quote path still reaches this router; the quote limiter has
    // already counted it, so it must not spend a catalog read as well.
    skip: isCartQuotePath,
    handler: (_req, res, _next, options) => {
      res.set('Cache-Control', 'no-store');
      res.status(options.statusCode).json(options.message);
    },
    message: errorResponse('RATE_LIMITED'),
  });
}

/** Per-IP ceiling on the public cart quote, per 15 min (plan 2026-09-15-001, CD-21). */
export const DEFAULT_CART_QUOTE_RATE_LIMIT_MAX = 300;

export function cartQuoteRateLimitMax(): number {
  return resolveCeiling(getEnv().CART_QUOTE_RATE_LIMIT_MAX, DEFAULT_CART_QUOTE_RATE_LIMIT_MAX);
}

/**
 * The cart quote's limiter, mounted by `app.ts` for that path only, ahead of body parsing.
 *
 * Per IP and nothing else. Browsers call the quote directly (CD-4), so a trusted server
 * bucket would be one budget every abuser shares with the storefront's SSR; a valid
 * `X-Catalog-Server-Token` therefore earns nothing here. Per IP is only as good as
 * `TRUST_PROXY` behind a proxy, and carrier NAT still shares addresses, which is why
 * per-client limiting at the edge remains the real control (UD-5).
 *
 * Its own store, so its `ip:` keys never meet the global or catalog limiter's. A 429 sets
 * `no-store` itself: it is answered before the route's own `no-store`.
 */
export function createCartQuoteLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: () => cartQuoteRateLimitMax(),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `ip:${req.ip ?? 'unknown'}`,
    handler: (_req, res, _next, options) => {
      res.set('Cache-Control', 'no-store');
      res.status(options.statusCode).json(options.message);
    },
    message: errorResponse('RATE_LIMITED'),
  });
}

/**
 * Boot visibility for the catalog limiter: an ignored ceiling, and -- in production -- the
 * `CATALOG_PUBLIC_ONLY` opt-out, which puts every shopper's server-rendered page into one
 * per-IP bucket of `CATALOG_RATE_LIMIT_MAX`. A production boot with no token and no opt-out
 * never gets here: `assertProductionEnv` refuses it.
 */
export function logCatalogRateLimitConfig(): void {
  const env = getEnv();
  warnIfIgnored(
    'CATALOG_RATE_LIMIT_MAX',
    env.CATALOG_RATE_LIMIT_MAX,
    DEFAULT_CATALOG_RATE_LIMIT_MAX
  );
  warnIfIgnored(
    'CATALOG_SERVER_RATE_LIMIT_MAX',
    env.CATALOG_SERVER_RATE_LIMIT_MAX,
    DEFAULT_CATALOG_SERVER_RATE_LIMIT_MAX
  );
  warnIfIgnored(
    'CART_QUOTE_RATE_LIMIT_MAX',
    env.CART_QUOTE_RATE_LIMIT_MAX,
    DEFAULT_CART_QUOTE_RATE_LIMIT_MAX
  );

  if (
    env.NODE_ENV === 'production' &&
    env.CATALOG_PUBLIC_ONLY &&
    splitCatalogServerTokens(env.CATALOG_SERVER_TOKEN).length === 0
  ) {
    logger.warn(
      'CATALOG_PUBLIC_ONLY=true and CATALOG_SERVER_TOKEN is unset: the storefront server has ' +
        'no trusted catalog bucket, so all of its catalog reads share one per-IP budget of ' +
        `${catalogRateLimitMax()}/15min.`
    );
  }
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
