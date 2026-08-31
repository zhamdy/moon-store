/**
 * Request counting and response gating.
 *
 * Counting has to be exact, because the whole point is proving a *second* request did not
 * happen. `page.waitForRequest` proves presence and is useless for proving absence, so
 * these attach a counter before the action and assert on it afterwards.
 */
import type { Page, Request, Route } from '@playwright/test';

export interface RequestCounter {
  /** Requests seen so far. */
  count: () => number;
  /** Every matching request's headers, in order. */
  headers: () => Array<Record<string, string>>;
  stop: () => void;
}

/**
 * Counts POSTs to a path.
 *
 * Filtering on `method === 'POST'` is load-bearing rather than tidy: `Idempotency-Key` is
 * a non-simple header, so every checkout is preceded by a CORS preflight. Counting all
 * requests would see each sale twice and report phantom duplicates.
 */
export function countPosts(page: Page, pathname: string): RequestCounter {
  const seen: Request[] = [];
  const listener = (request: Request) => {
    if (request.method() !== 'POST') return;
    if (!new URL(request.url()).pathname.endsWith(pathname)) return;
    seen.push(request);
  };
  page.on('request', listener);
  return {
    count: () => seen.length,
    headers: () => seen.map((r) => r.headers()),
    stop: () => page.off('request', listener),
  };
}

export interface ResponseGate {
  /** Resolves once the first matching request has been intercepted. */
  waitForFirst: () => Promise<void>;
  /** Lets every held request through. */
  release: () => Promise<void>;
}

/**
 * Holds responses to a path open until released.
 *
 * A real double-click rarely reproduces a double-submit: the first request completes in
 * milliseconds, so the guard is never actually under test. Widening the window
 * deliberately is what makes the assertion meaningful.
 */
export async function gateResponses(page: Page, pathname: string): Promise<ResponseGate> {
  let releaseAll: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    releaseAll = resolve;
  });

  let firstSeen: () => void = () => {};
  const first = new Promise<void>((resolve) => {
    firstSeen = resolve;
  });

  await page.route(
    (url) => url.pathname.endsWith(pathname),
    async (route: Route) => {
      if (route.request().method() !== 'POST') return route.continue();
      // Send it straight away and hold the *response*, rather than parking the request.
      // The window this widens is the one that matters — the client believing a checkout
      // is still in flight — and a long-parked `continue()` does not resume reliably.
      const response = await route.fetch();
      firstSeen();
      await held;
      await route.fulfill({ response });
    }
  );

  return {
    waitForFirst: () => first,
    /**
     * Deliberately does not `unroute`. Removing a handler while one of its invocations is
     * still parked on `held` deadlocks, and the route is harmless once released — the
     * page is closed at the end of the test either way.
     */
    release: async () => {
      releaseAll();
    },
  };
}
