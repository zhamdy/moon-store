import { Request, Response, NextFunction } from 'express';

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
  (seconds: number) => (_req: Request, res: Response, next: NextFunction) => {
    const writeHead = res.writeHead;
    res.writeHead = function (this: Response, statusCode: number, ...rest: unknown[]) {
      const cacheable = (statusCode >= 200 && statusCode < 300) || statusCode === 304;
      this.setHeader('Cache-Control', cacheable ? `public, max-age=${seconds}` : 'no-store');
      return (writeHead as (...args: unknown[]) => Response).call(this, statusCode, ...rest);
    } as Response['writeHead'];
    next();
  };
