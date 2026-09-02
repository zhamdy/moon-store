/**
 * Single resolution point for every JWT and cookie setting the auth module uses.
 *
 * Before this file the same knobs were read as bare `process.env` lookups scattered
 * across the service and the controller, which had two concrete costs: a missing
 * `JWT_SECRET` reached `jwt.sign` as `undefined` instead of failing the environment
 * parse at boot, and `res.cookie` and `res.clearCookie` derived their attributes
 * independently — a browser only drops a cookie when the clearing attributes match the
 * ones it was set with, so the two drifting apart is a logout that silently leaves the
 * cookie in place.
 *
 * The operational knobs are held in the environment as raw strings and resolved here,
 * the same posture `src/http/rateLimits.ts` takes for its ceilings: a typo must fall back
 * to the safe value and say so, not fail the whole environment parse and take the shop
 * down. Everything resolves at call time rather than at import time, so tests can change
 * the environment and reset the cache.
 */
import type { CookieOptions } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import { getEnv } from '../../../config/env';
import logger from '../../../../lib/logger';

export const REFRESH_COOKIE_NAME = 'refreshToken';

/** Today's access-token lifetime. An unset `JWT_ACCESS_TTL` reproduces it exactly. */
export const DEFAULT_ACCESS_TTL = '15m';

/**
 * Ceiling on the access-token lifetime.
 *
 * The access token is the one credential revocation cannot reach: it is accepted on its
 * signature alone, with no database read, so logout, logout-all, family revocation and
 * reuse detection are all no-ops for whatever remains of its life. `JWT_ACCESS_TTL=7d`
 * would therefore turn every revocation mechanism in this module into a suggestion for a
 * week. An hour is already four times the default and past any plausible intent; beyond
 * it the value is treated as a misconfiguration rather than honoured.
 */
export const MAX_ACCESS_TTL_SECONDS = 60 * 60;

/** Today's refresh-session lifetime, in days. */
export const DEFAULT_REFRESH_TTL_DAYS = 7;
const MAX_REFRESH_TTL_DAYS = 365;

/**
 * Default replay grace window, in seconds.
 *
 * Re-derived from the two cases it has to absorb rather than picked round:
 *
 *  - Two clients sharing one cookie jar (tabs, or a device restored from a session)
 *    refreshing together. Sub-second, and the client's own interceptor already
 *    de-duplicates within a single tab.
 *  - A client that never received the response to its refresh and asks again. This is the
 *    slow one: the client cannot even observe the failure until its HTTP request times
 *    out, and the transport sets no `timeout`, so the bound is the browser's own — tens
 *    of seconds, commonly 30 or more, before a retry can be issued at all.
 *
 * The earlier 10s default sat below the timescale of the second case, so the very
 * failure the window exists to absorb usually landed outside it. 60s covers a 30s
 * timeout plus the retry that follows, and is still four orders of magnitude short of
 * the 7-day session it sits inside.
 *
 * What widening it costs is now much less than it was: a tolerated replay returns the
 * successor that was *already issued* and writes nothing, so a wider window does not let
 * anyone obtain a new session — only the successor their own token already entitles them
 * to, and which they could have obtained a moment earlier by presenting it. Set to 0 for
 * strict no-grace semantics.
 */
export const DEFAULT_ROTATION_GRACE_SECONDS = 60;
const MAX_ROTATION_GRACE_SECONDS = 600;

export const DEFAULT_COOKIE_SAMESITE = 'lax';
const SAME_SITE_VALUES = ['lax', 'strict', 'none'] as const;
type SameSite = (typeof SAME_SITE_VALUES)[number];

/**
 * A resolver that ignores its configured value must say so exactly once.
 *
 * Once, because these resolve on the request path (the composition root cannot call them
 * at boot without resolving the environment before its own clean missing-secret check —
 * see the note in `rateLimits.ts`), and a per-request warning would bury itself. Exactly
 * once, because an ignored value is the quiet, dangerous case: the operator's intended
 * setting never takes effect and the logs are otherwise byte-identical to an unset server.
 */
const warned = new Set<string>();

function warnIgnored(name: string, raw: string, using: string | number): void {
  if (warned.has(name)) return;
  warned.add(name);
  logger.warn(
    `${name}="${raw}" is not a valid value and was ignored; using ${using}. ` +
      'Fix the environment or the intended setting will never take effect.'
  );
}

/** Test seam: forget which overrides have already been warned about. */
export function resetAuthConfigWarnings(): void {
  warned.clear();
}

/** `jsonwebtoken` duration syntax: a whole number of units, or bare seconds. */
const DURATION = /^(\d+)(ms|s|m|h|d|w|y)?$/;

const UNIT_SECONDS: Record<string, number> = {
  ms: 0.001,
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  y: 31557600,
};

/** Seconds a `jsonwebtoken` duration string represents, or undefined if it is not one. */
export function durationToSeconds(raw: string): number | undefined {
  const match = DURATION.exec(raw.trim());
  if (!match) return undefined;
  return Number(match[1]) * UNIT_SECONDS[match[2] ?? 's'];
}

/**
 * Access-token lifetime, capped. A value that is not a duration, or is longer than
 * `MAX_ACCESS_TTL_SECONDS`, falls back to the default and is warned about — the same
 * fall-back-and-warn posture the rate-limit ceilings use, chosen over failing the boot
 * so that a typo in one knob cannot take a shop offline.
 */
export function resolveAccessTtl(raw: string | undefined): string {
  if (raw === undefined) return DEFAULT_ACCESS_TTL;

  const seconds = durationToSeconds(raw);
  if (seconds === undefined || seconds <= 0) {
    warnIgnored('JWT_ACCESS_TTL', raw, DEFAULT_ACCESS_TTL);
    return DEFAULT_ACCESS_TTL;
  }
  if (seconds > MAX_ACCESS_TTL_SECONDS) {
    if (!warned.has('JWT_ACCESS_TTL')) {
      warned.add('JWT_ACCESS_TTL');
      logger.warn(
        `JWT_ACCESS_TTL="${raw}" exceeds the ${MAX_ACCESS_TTL_SECONDS}s ceiling and was ignored; ` +
          `using ${DEFAULT_ACCESS_TTL}. An access token is accepted on its signature alone, so ` +
          'logout, global revocation and reuse detection cannot reach one until it expires.'
      );
    }
    return DEFAULT_ACCESS_TTL;
  }
  return raw.trim();
}

export function resolveRefreshTtlDays(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_REFRESH_TTL_DAYS;

  const trimmed = raw.trim();
  const parsed = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(parsed) || parsed <= 0) {
    warnIgnored('JWT_REFRESH_TTL_DAYS', raw, DEFAULT_REFRESH_TTL_DAYS);
    return DEFAULT_REFRESH_TTL_DAYS;
  }
  if (parsed > MAX_REFRESH_TTL_DAYS) {
    warnIgnored('JWT_REFRESH_TTL_DAYS', raw, DEFAULT_REFRESH_TTL_DAYS);
    return DEFAULT_REFRESH_TTL_DAYS;
  }
  return parsed;
}

/** Grace window in seconds. `0` is a legitimate value: it means strict, no-grace rotation. */
export function resolveRotationGraceSeconds(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_ROTATION_GRACE_SECONDS;

  const trimmed = raw.trim();
  const parsed = Number(trimmed);
  if (
    !/^\d+$/.test(trimmed) ||
    !Number.isSafeInteger(parsed) ||
    parsed > MAX_ROTATION_GRACE_SECONDS
  ) {
    warnIgnored('REFRESH_ROTATION_GRACE_SECONDS', raw, DEFAULT_ROTATION_GRACE_SECONDS);
    return DEFAULT_ROTATION_GRACE_SECONDS;
  }
  return parsed;
}

/**
 * `SameSite`, matched case-insensitively.
 *
 * The attribute is spelled `SameSite=None` in every specification, browser devtool and
 * blog post an operator has ever read, so a case-sensitive match means `COOKIE_SAMESITE=None`
 * refuses to boot a server over letter case.
 */
export function resolveSameSite(raw: string | undefined): SameSite {
  if (raw === undefined) return DEFAULT_COOKIE_SAMESITE;

  const normalized = raw.trim().toLowerCase();
  const match = SAME_SITE_VALUES.find((value) => value === normalized);
  if (!match) {
    warnIgnored('COOKIE_SAMESITE', raw, DEFAULT_COOKIE_SAMESITE);
    return DEFAULT_COOKIE_SAMESITE;
  }
  return match;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  /** `jsonwebtoken` duration string for the access token. */
  accessTtl: NonNullable<SignOptions['expiresIn']>;
  /** `jsonwebtoken` duration string for the refresh token. */
  refreshTtl: NonNullable<SignOptions['expiresIn']>;
  /** The same refresh lifetime in milliseconds, for `expires_at` and `maxAge`. */
  refreshTtlMs: number;
}

export function jwtConfig(): JwtConfig {
  const env = getEnv();
  const refreshTtlDays = resolveRefreshTtlDays(env.JWT_REFRESH_TTL_DAYS);

  return {
    accessSecret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    // `expiresIn` is typed as a template-literal union that no runtime-parsed string can
    // satisfy structurally. Both values are shape-checked by the resolvers above, which
    // is a stronger guarantee than the type: they also bound the range.
    accessTtl: resolveAccessTtl(env.JWT_ACCESS_TTL) as NonNullable<SignOptions['expiresIn']>,
    refreshTtl: `${refreshTtlDays}d` as NonNullable<SignOptions['expiresIn']>,
    refreshTtlMs: refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

/** Grace window for a replayed just-rotated token, in milliseconds. See `env.ts`. */
export function rotationGraceMs(): number {
  return resolveRotationGraceSeconds(getEnv().REFRESH_ROTATION_GRACE_SECONDS) * 1000;
}

/**
 * Attributes shared by setting and clearing the refresh cookie. `maxAge` is deliberately
 * *not* here: it is the one attribute that must differ between the two.
 */
function baseCookieOptions(): CookieOptions {
  const env = getEnv();
  const sameSite = resolveSameSite(env.COOKIE_SAMESITE);

  return {
    httpOnly: true,
    // Production always gets Secure. `SameSite=None` also forces it in any environment,
    // because a browser rejects that combination outright — silently, on the Set-Cookie,
    // which would look like "refresh just stopped working" rather than a config error.
    secure: env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

/** Options for `res.cookie` when issuing a refresh token. */
export function refreshCookieOptions(): CookieOptions {
  return { ...baseCookieOptions(), maxAge: jwtConfig().refreshTtlMs };
}

/**
 * Options for `res.clearCookie`. Must match the set attributes exactly apart from the
 * expiry, or the browser keeps the cookie and the user stays "logged in" client-side.
 */
export function clearRefreshCookieOptions(): CookieOptions {
  return baseCookieOptions();
}

/**
 * Reports every auth knob whose configured value was ignored, and every effective value
 * that differs from the default.
 *
 * Exported for a boot-time call from the composition root, alongside
 * `logRateLimitOverrides()`. It is not wired there in this change because
 * `server/index.ts` is owned by another branch; until it is, the resolvers above warn on
 * first use instead, which for a server that serves any request at all is boot-adjacent.
 */
export function logAuthConfigOverrides(): void {
  const env = getEnv();
  const accessTtl = resolveAccessTtl(env.JWT_ACCESS_TTL);
  const graceSeconds = resolveRotationGraceSeconds(env.REFRESH_ROTATION_GRACE_SECONDS);
  const refreshDays = resolveRefreshTtlDays(env.JWT_REFRESH_TTL_DAYS);

  if (
    accessTtl === DEFAULT_ACCESS_TTL &&
    graceSeconds === DEFAULT_ROTATION_GRACE_SECONDS &&
    refreshDays === DEFAULT_REFRESH_TTL_DAYS
  ) {
    return;
  }

  logger.warn(
    `Auth token settings overridden: access TTL=${accessTtl} (default ${DEFAULT_ACCESS_TTL}), ` +
      `refresh TTL=${refreshDays}d (default ${DEFAULT_REFRESH_TTL_DAYS}d), ` +
      `rotation grace=${graceSeconds}s (default ${DEFAULT_ROTATION_GRACE_SECONDS}s).`
  );
}
