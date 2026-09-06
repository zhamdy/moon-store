/**
 * The auth module's request contracts (#102).
 *
 * These are the only contracts in the repo whose *refusals* are hand-mapped rather than
 * left to the validation error handler, and the reason is the whole point of the module:
 * what a failure tells the caller is part of the security contract, not a detail.
 *
 * - A missing email or password is a `400`, exactly as the truthiness check it replaces.
 * - A missing or unusable refresh cookie is a `401` with one opaque message, so a caller
 *   holding a stolen token cannot learn which failure it hit.
 *
 * So the controller catches the parse and re-throws the `PublicError` it already threw.
 * The schema exists to be published and to be the single description of the shape; it is
 * not allowed to change what the caller is told.
 */
import { z } from 'zod';
import { defineRequestContract } from '../../../http/requestContracts';
import { REFRESH_COOKIE_NAME } from './config';

/**
 * Not `.strict()`, deliberately. The previous check destructured two fields and ignored
 * everything else, so rejecting an extra key would break a client that sends one today —
 * a tightening bought with a docs change, which is the trade this work refuses.
 */
export const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

/** The httpOnly cookie rotation issues. Never in a body, never in the response body. */
export const refreshCookieSchema = z.object({
  [REFRESH_COOKIE_NAME]: z.string().min(1),
});

export const authRequestContracts = {
  login: defineRequestContract({
    method: 'POST',
    path: '/api/v1/auth/login',
    operation: 'login',
    body: loginSchema,
    beyondSchema: [
      'A missing or empty field is a 400. Wrong credentials are a 401 with a single ' +
        'message for both "no such user" and "wrong password", so the endpoint cannot ' +
        'be used to enumerate accounts.',
      'Sets an httpOnly `refreshToken` cookie. The refresh token is never in the body.',
      'IP-rate-limited separately from the global ceiling (`AUTH_RATE_LIMIT_MAX`), ' +
        'because a credential-guessing caller is unauthenticated by definition.',
    ],
  }),

  refresh: defineRequestContract({
    noBody: true,
    method: 'POST',
    path: '/api/v1/auth/refresh',
    operation: 'refresh',
    cookies: refreshCookieSchema,
    beyondSchema: [
      'Takes no body. The credential is the httpOnly `refreshToken` cookie.',
      'Every failure is the same opaque 401: absent, expired, revoked, and replayed ' +
        'past the grace window are deliberately indistinguishable to the caller.',
      'Rotates: the presented token is dead on success and the successor comes back as ' +
        'a new cookie. A successor never extends the session beyond the original expiry.',
    ],
  }),

  logout: defineRequestContract({
    noBody: true,
    method: 'POST',
    path: '/api/v1/auth/logout',
    operation: 'logout',
    cookies: refreshCookieSchema.partial(),
    beyondSchema: [
      'The cookie is optional: an already logged-out caller still gets a 204, so a ' +
        'client can always reach a signed-out state.',
      "Ends the presented token's whole family, not just that token.",
    ],
  }),

  logoutAll: defineRequestContract({
    noBody: true,
    method: 'POST',
    path: '/api/v1/auth/logout-all',
    operation: 'logoutAll',
    beyondSchema: [
      'Identified by the access token, so a caller can only ever revoke their own ' +
        'sessions. The refresh cookie is not consulted and need not be present.',
      'Cannot reach an access token already issued, which is why that lifetime is short ' +
        'and capped at one hour.',
    ],
  }),

  getMe: defineRequestContract({
    method: 'GET',
    path: '/api/v1/auth/me',
    operation: 'getMe',
  }),
} as const;

export const authContractList = Object.values(authRequestContracts);
