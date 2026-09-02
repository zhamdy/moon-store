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
 * Everything here reads through `getEnv()`, and every function resolves at call time
 * rather than at import time so tests can change the environment and reset the cache.
 */
import type { CookieOptions } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import { getEnv } from '../../../config/env';

export const REFRESH_COOKIE_NAME = 'refreshToken';

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
  return {
    accessSecret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    // `expiresIn` is typed as a template-literal union that no runtime-parsed string can
    // satisfy structurally. Both values are shape-checked in `env.ts` instead — a regex
    // for the access TTL, a positive integer for the refresh days.
    accessTtl: env.JWT_ACCESS_TTL as NonNullable<SignOptions['expiresIn']>,
    refreshTtl: `${env.JWT_REFRESH_TTL_DAYS}d` as NonNullable<SignOptions['expiresIn']>,
    refreshTtlMs: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

/** Grace window for a replayed just-rotated token, in milliseconds. See `env.ts`. */
export function rotationGraceMs(): number {
  return getEnv().REFRESH_ROTATION_GRACE_SECONDS * 1000;
}

/**
 * Attributes shared by setting and clearing the refresh cookie. `maxAge` is deliberately
 * *not* here: it is the one attribute that must differ between the two.
 */
function baseCookieOptions(): CookieOptions {
  const env = getEnv();
  const sameSite = env.COOKIE_SAMESITE;

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
