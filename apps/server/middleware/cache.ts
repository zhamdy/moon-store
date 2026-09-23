import { Request, Response, NextFunction } from 'express';
import { isCartQuotePath } from '../src/http/rateLimits';

export const cacheControl =
  (seconds: number) => (_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `private, max-age=${seconds}`);
    next();
  };

/**
 * `public, max-age=<seconds>` on a successful response, `no-store` on every other.
 *
 * The status is not known when middleware runs, so the header is decided at `writeHead`,
 * which Node calls for every response (implicitly from `res.end`). A 404, 429 or 500 must
 * never be shared-cached: a CDN holding one would answer every shopper with it. 304 counts
 * as success -- it revalidates a cached 2xx, and `no-store` on it would evict that entry.
 */
export const publicCacheOnSuccess =
  (seconds: number) => (req: Request, res: Response, next: NextFunction) => {
    // The cart quote is priced, per-bag data: every status on its path is `no-store`,
    // and this middleware decides the header at `writeHead` on **any** 2xx regardless of
    // method, so setting no-store earlier in the chain is not enough - it would simply be
    // rewritten here. An OPTIONS that cors() does not short-circuit misses the POST
    // handler and is answered by Express's built-in responder with a 200, which used to
    // ship `public, max-age=60` on the pricing endpoint's own URL (MED-2). Skipping the
    // path outright is the one guard no method can slip past.
    // Inside a mounted router `req.path` is relative to the mount, so the full path has
    // to be rebuilt: `isCartQuotePath` matches the absolute one the app-level chain sees.
    if (isCartQuotePath({ path: `${req.baseUrl}${req.path}` })) {
      next();
      return;
    }
    const writeHead = res.writeHead;
    res.writeHead = function (this: Response, statusCode: number, ...rest: unknown[]) {
      const cacheable = (statusCode >= 200 && statusCode < 300) || statusCode === 304;
      this.setHeader('Cache-Control', cacheable ? `public, max-age=${seconds}` : 'no-store');
      return (writeHead as (...args: unknown[]) => Response).call(this, statusCode, ...rest);
    } as Response['writeHead'];
    next();
  };
