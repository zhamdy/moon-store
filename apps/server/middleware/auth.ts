import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { errorResponse } from '../src/http/errors';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

function verifyToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('UNAUTHORIZED'));
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthUser;
    req.user = decoded;
    next();
  } catch (_err) {
    res.status(401).json(errorResponse('UNAUTHORIZED'));
    return;
  }
}

/** Where `requireRole` records the roles it admits, so a gate can read them back. */
const ROLES = Symbol.for('moon.requireRole.roles');

function requireRole(...roles: string[]) {
  const middleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('UNAUTHORIZED'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json(errorResponse('FORBIDDEN'));
      return;
    }
    next();
  };
  // A closure hides its roles; `scripts/checkRouteAuthorization.ts` compares them against
  // the endpoint manifest, and reading them here beats re-parsing route source text.
  Object.defineProperty(middleware, ROLES, { value: Object.freeze([...roles]) });
  return middleware;
}

/** The roles a `requireRole(...)` middleware admits, or `null` for any other function. */
function rolesRequiredBy(handler: unknown): readonly string[] | null {
  if (typeof handler !== 'function') return null;
  return (handler as unknown as Record<symbol, readonly string[] | undefined>)[ROLES] ?? null;
}

export { verifyToken, requireRole, rolesRequiredBy };
