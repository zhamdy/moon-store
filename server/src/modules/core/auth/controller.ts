import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAudit } from '../../../../middleware/auditLogger';
import { PublicError } from '../../../http/errors';
import { success } from '../../../http/responses';
import { authService } from './service';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookieOptions,
  refreshCookieOptions,
} from './config';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        throw new PublicError('VALIDATION_ERROR', 'Email and password required');
      }

      const result = await authService.login({ email, password });

      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());

      logAudit({
        userId: result.user.id,
        userName: result.user.name,
        action: 'login',
        entityType: 'auth',
        entityId: result.user.id,
        details: { email: result.user.email, role: result.user.role },
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.json(success({ accessToken: result.accessToken, user: result.user }));
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      if (!refreshToken) {
        throw new PublicError('UNAUTHORIZED', 'Refresh token required');
      }

      const result = await authService.refresh(refreshToken);
      res.json(success(result));
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      await authService.logout(refreshToken);
      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const user = await authService.getMe(authReq.user!.id);
      if (!user) {
        throw new PublicError('NOT_FOUND', 'User not found');
      }
      res.json(success(user));
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
