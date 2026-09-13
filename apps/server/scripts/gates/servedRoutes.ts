/**
 * What the live app serves, and the middleware chain in front of each route (#162).
 *
 * Walks `createApp()` — the app `index.ts` runs — rather than `routeTable` alone, so a route
 * mounted directly on the app (the health probes, `/openapi.json`) is seen too, and a router
 * mounted outside the table fails loudly instead of being silently skipped.
 */
import type { Express, Router } from 'express';
import { createApp } from '../../src/app';
import { routeTable } from '../../src/router';
import { rolesRequiredBy, verifyToken } from '../../middleware/auth';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ServedRoute {
  method: Method;
  /** Express dialect, e.g. `/api/v1/products/:id`. */
  path: string;
  /** Every handler the request passes through, router-level middleware first. */
  handlers: readonly unknown[];
}

/** What a route's middleware chain actually enforces. */
export type DerivedAuthorization =
  | { kind: 'public' }
  | { kind: 'authenticated'; roles: readonly string[] | 'any' }
  /** `requireRole` with no `verifyToken` ahead of it rejects everyone with a 401. */
  | { kind: 'misordered' };

interface Layer {
  route?: { path: string | string[]; methods: Record<string, boolean>; stack: Layer[] };
  handle?: unknown;
  regexp?: RegExp & { fast_slash?: boolean };
  name?: string;
}

const METHODS: readonly Method[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

function isAuthMiddleware(handler: unknown): boolean {
  return handler === verifyToken || rolesRequiredBy(handler) !== null;
}

function walkStack(stack: Layer[], mount: string, inherited: unknown[]): ServedRoute[] {
  const routes: ServedRoute[] = [];
  const applied = [...inherited];

  for (const layer of stack) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
      const handlers = [...applied, ...layer.route.stack.map((l) => l.handle)];
      for (const p of paths) {
        for (const [method, enabled] of Object.entries(layer.route.methods)) {
          const upper = method.toUpperCase() as Method;
          if (!enabled || !METHODS.includes(upper)) continue;
          routes.push({ method: upper, path: `${mount}${p === '/' ? '' : p}`, handlers });
        }
      }
      continue;
    }

    const nested = (layer.handle as { stack?: Layer[] } | undefined)?.stack;
    if (nested) {
      if (!layer.regexp?.fast_slash) {
        throw new Error(
          `A router nested under a sub-path inside ${mount || 'the app'} cannot be read back ` +
            'into a path by this walker. Mount it through routeTable.'
        );
      }
      routes.push(...walkStack(nested, mount, applied));
      continue;
    }

    // `router.use(fn)`: middleware for everything after it. Auth scoped to a sub-path would
    // need regexp matching to attribute correctly, so refuse it rather than guess.
    if (isAuthMiddleware(layer.handle)) {
      if (!layer.regexp?.fast_slash) {
        throw new Error(
          `Path-scoped auth middleware under ${mount || 'the app'} is not supported by the walker.`
        );
      }
      applied.push(layer.handle);
    }
  }
  return routes;
}

/** Every route `app` serves. Routers are attributed to their `routeTable` mount by identity. */
export function servedRoutesOf(
  app: Express,
  table: ReadonlyArray<readonly [string, Router]>
): ServedRoute[] {
  const appStack = (app as unknown as { _router?: { stack: Layer[] } })._router?.stack ?? [];
  const mounts = new Map<unknown, string>(table.map(([mount, router]) => [router, mount]));
  const routes: ServedRoute[] = [];
  const appLevelAuth: unknown[] = [];

  for (const layer of appStack) {
    if (layer.route) {
      routes.push(...walkStack([layer], '', appLevelAuth));
      continue;
    }
    const nested = (layer.handle as { stack?: Layer[] } | undefined)?.stack;
    if (nested) {
      const mount = mounts.get(layer.handle);
      if (mount === undefined) {
        throw new Error(
          'createApp() mounts a router that is not in routeTable, so its paths cannot be named. ' +
            'Mount it through src/router.ts.'
        );
      }
      routes.push(...walkStack(nested, mount, appLevelAuth));
      continue;
    }
    if (isAuthMiddleware(layer.handle)) appLevelAuth.push(layer.handle);
  }
  return routes;
}

/** The routes the real app serves. */
export function liveServedRoutes(): ServedRoute[] {
  // createApp() validates the environment. This process never signs or verifies a token
  // and never listens, so placeholders stand in only where nothing was provided.
  process.env.JWT_SECRET ??= 'route-walk-placeholder-secret-not-for-signing-000';
  process.env.JWT_REFRESH_SECRET ??= 'route-walk-placeholder-refresh-not-for-signing-0';
  return servedRoutesOf(createApp(), routeTable);
}

/**
 * Reads what a chain enforces. Only `verifyToken` and `requireRole` are recognised; a check
 * made inside a controller is invisible here, which is exactly why the manifest records it
 * as a `predicate` rather than as roles.
 */
export function deriveAuthorization(handlers: readonly unknown[]): DerivedAuthorization {
  let authenticated = false;
  let roles: readonly string[] | 'any' = 'any';

  for (const handler of handlers) {
    if (handler === verifyToken) {
      authenticated = true;
      continue;
    }
    const required = rolesRequiredBy(handler);
    if (required === null) continue;
    if (!authenticated) return { kind: 'misordered' };
    // Two `requireRole`s in a row admit only what both admit.
    roles = roles === 'any' ? required : roles.filter((r) => required.includes(r));
  }

  return authenticated ? { kind: 'authenticated', roles } : { kind: 'public' };
}
