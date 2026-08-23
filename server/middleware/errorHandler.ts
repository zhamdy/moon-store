import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { mapPublicError } from '../src/http/errors';

function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const mapped = mapPublicError(err);
  logger.error('Request error', mapped.diagnostic);
  res.status(mapped.status).json(mapped.body);
}

export default errorHandler;
