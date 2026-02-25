import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
}

function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  console.error('Error:', err.message);
  if (isDev) {
    console.error(err.stack);
  }

  // Only expose internal error details in development
  const message =
    isDev || statusCode < 500 ? err.message || 'Internal server error' : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

export default errorHandler;
