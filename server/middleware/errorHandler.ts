import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  statusCode?: number;
}

function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  console.error('Error:', err.message);
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}

export default errorHandler;
