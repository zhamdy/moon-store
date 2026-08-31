import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
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

export function createGlobalLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: globalRateLimitMax(),
    standardHeaders: true,
    legacyHeaders: false,
    message: errorResponse('RATE_LIMITED'),
  });
}

export function createAuthLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: authRateLimitMax(),
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
  const global = globalRateLimitMax();
  const auth = authRateLimitMax();
  if (global === DEFAULT_RATE_LIMIT_MAX && auth === DEFAULT_AUTH_RATE_LIMIT_MAX) return;

  logger.warn(
    `Rate limit ceilings overridden: global=${global}/15min (default ${DEFAULT_RATE_LIMIT_MAX}), ` +
      `auth=${auth}/15min (default ${DEFAULT_AUTH_RATE_LIMIT_MAX}). ` +
      'Expected for test runs only.'
  );
}
