import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { routeTable } from '../../src/router';
import errorHandler from '../../middleware/errorHandler';

export function createTestApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Mount all routes
  for (const [routePath, router] of routeTable) {
    app.use(routePath, router);
  }

  // Intercept uncaught 500s or error handler calls for diagnostics
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    (res as any).__rawError = err;
    // Forward to normal error handler
    errorHandler(err, req, res, next);
  });

  return app;
}
