import { Request, Response, NextFunction } from 'express';

export const cacheControl =
  (seconds: number) => (_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `private, max-age=${seconds}`);
    next();
  };
