import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';

const allowedQueryKeys = new Set([
  'page',
  'pageSize',
  'sortBy',
  'sortOrder',
  'status',
  'categoryId',
  'lowStock',
  'dateFrom',
  'dateTo',
  'paymentMethod',
  'cashierId',
]);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    const queryKeys = Object.keys(req.query)
      .filter((key) => allowedQueryKeys.has(key))
      .sort();
    const routePath = `${req.baseUrl || ''}${req.path}` || '/';
    logger[level](`${req.method} ${routePath} ${res.statusCode}`, {
      method: req.method,
      path: routePath,
      query_keys: queryKeys,
      status: res.statusCode,
      duration_ms: duration,
    });
  });

  next();
}
