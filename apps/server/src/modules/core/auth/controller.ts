import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../../middleware/auth';
import { logAudit } from '../../../../middleware/auditLogger';
import { PublicError } from '../../../http/errors';
import { success } from '../../../http/responses';
import { authService } from './service';
import { authRequestContracts } from './schemas';
import { REFRESH_COOKIE_NAME, clearRefreshCookieOptions, refreshCookieOptions } from './config';

const contracts = authRequestContracts;

/**
 * Parse through the contract, but keep the refusal this endpoint already gave.
 *
 * Everywhere else a Zod failure becomes a 400 `VALIDATION_ERROR` with field detail. On the
 * credential paths that detail is the product: an opaque 401 is what stops a caller
 * distinguishing "no such account" from "wrong password", and a 400 for a malformed cookie
 * would tell a thief their token was the wrong shape. The schema decides the shape; this
 * decides the answer.
 */
function parseOrRefuse<T>(parse: () => T, refusal: PublicError): T {
  try {
    return parse();
  } catch {
    throw refusal;
  }
}

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = parseOrRefuse(
        () => contracts.login.parseBody<{ email: string; password: string }>(req.body),
        new PublicError('VALIDATION_ERROR', 'Email and password required')
      );

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
      const refreshToken = parseOrRefuse(
        () =>
          contracts.refresh.parseCookies<Record<string, string>>({
            [REFRESH_COOKIE_NAME]: req.cookies?.[REFRESH_COOKIE_NAME],
          })[REFRESH_COOKIE_NAME],
        new PublicError('UNAUTHORIZED', 'Refresh token required')
      );

      const result = await authService.refresh(refreshToken);

      // Rotation: the cookie the caller sent is dead the moment this succeeds, so the
      // successor has to go back in the same response. The body is unchanged — the
      // refresh token has never been part of it and stays httpOnly.
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());

      res.json(success({ accessToken: result.accessToken, user: result.user }));
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Optional by contract: an already logged-out caller still gets a 204.
      const { [REFRESH_COOKIE_NAME]: refreshToken } = contracts.logout.parseCookies<
        Record<string, string | undefined>
      >({ [REFRESH_COOKIE_NAME]: req.cookies?.[REFRESH_COOKIE_NAME] });
      await authService.logout(refreshToken);
      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
      res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Ends every session this user has, on every device. The lever for a lost device or a
   * suspected compromise; a plain logout only ends the session in hand.
   *
   * Authenticated by the access token, so a caller can only ever revoke their own
   * sessions — the refresh cookie is not consulted and does not need to be present.
   */
  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const revokedSessions = await authService.revokeAllSessions(userId);

      res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());

      logAudit({
        userId,
        userName: authReq.user!.name,
        action: 'logout_all',
        entityType: 'auth',
        entityId: userId,
        details: { revokedSessions },
        ipAddress: req.ip || req.socket?.remoteAddress,
      });

      res.json(success({ revokedSessions }));
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
