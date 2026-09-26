import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return handleI18nRouting(request);
}

export const config = {
  // next-intl's recommended matcher: skip Next internals, Vercel internals, and
  // any path containing a dot (static files). A future route segment containing
  // a dot would bypass locale handling — see apps/storefront/CLAUDE.md.
  //
  // `api` is excluded because Route Handlers are not pages and have no locale: without
  // this, `POST /api/revalidate` is answered with a 307 to `/en/api/revalidate` and the
  // server's cache-invalidation ping never reaches a handler at all.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
