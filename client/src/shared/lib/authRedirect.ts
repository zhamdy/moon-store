import type { AuthUser, UserRole } from '../types';

export function getDefaultRoute(
  user: AuthUser | { role?: UserRole | string } | null | undefined
): string {
  if (user?.role === 'Admin') return '/';
  if (user?.role === 'Cashier') return '/pos';
  if (user?.role === 'Delivery') return '/deliveries';
  return '/login';
}

/**
 * The `redirect` search param is the only thing that gets a user back to the
 * screen their session expired on, and it is also the only thing on the login
 * route an attacker can choose. So it is filtered here, once, rather than
 * trusted at either end.
 *
 * Returns the target to send the user to after signing in, or `undefined` when
 * the value is not a place we are willing to bounce to:
 *
 * - anything that is not an in-app absolute path (`/inventory`), which rules
 *   out `https://evil.example` outright;
 * - a protocol-relative path (`//evil.example`, and its `/\` variant, which
 *   several browsers normalise the same way) — these look internal and are not;
 * - `/login` itself, which would loop.
 *
 * Route-level authorisation is NOT this function's job: `_authenticated` and
 * `_admin` still guard their subtrees, so a stale link to an admin page is
 * bounced by the router, not silently honoured here.
 */
export function safeRedirectTarget(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const target = value.trim();
  if (!target.startsWith('/')) return undefined;
  if (target.startsWith('//') || target.startsWith('/\\')) return undefined;
  if (target === '/login' || target.startsWith('/login?') || target.startsWith('/login#')) {
    return undefined;
  }
  return target;
}
