import { Request, Response, NextFunction } from 'express';
import type { SessionHistoryFilters } from './types';
import {
  registerRequestContracts,
  type CloseRegisterBody,
  type MovementBody,
  type OpenRegisterBody,
} from './schemas';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { registerService, IRegisterService } from './service';
import { PublicError } from '../../../http/errors';
import { paginationMeta } from '../../../http/pagination';
import { success } from '../../../http/responses';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = registerRequestContracts;

export class RegisterController {
  constructor(private service: IRegisterService = registerService) {}

  async getCurrentSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;

      const session = await this.service.getCurrentSession(userId);
      res.json(success(session));
    } catch (err) {
      next(err);
    }
  }

  async openSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = contracts.openRegister.parseBody<OpenRegisterBody>(req.body);

      const result = await this.service.openSession(userId, parsed.opening_float);
      if (result.error) {
        throw new PublicError('VALIDATION_ERROR', result.error);
      }

      logAuditFromReq(req, 'register_open', 'register_session', result.session!.id, {
        opening_float: parsed.opening_float,
      });

      res.json(success(result.session!));
    } catch (err) {
      next(err);
    }
  }

  async addMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = contracts.recordMovement.parseBody<MovementBody>(req.body);

      const result = await this.service.addMovement(
        userId,
        parsed.type,
        parsed.amount,
        parsed.note
      );
      if (result.error) {
        throw new PublicError('VALIDATION_ERROR', result.error);
      }

      res.json(success(result.movement));
    } catch (err) {
      next(err);
    }
  }

  async closeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = contracts.closeRegister.parseBody<CloseRegisterBody>(req.body);

      const result = await this.service.closeSession(userId, parsed.counted_cash, parsed.notes);
      if (result.error) {
        throw new PublicError('VALIDATION_ERROR', result.error);
      }

      logAuditFromReq(req, 'register_close', 'register_session', result.session!.id, {
        expected_cash: result.session!.expected_cash,
        counted_cash: parsed.counted_cash,
        variance: result.session!.variance,
      });

      res.json(success(result.session!));
    } catch (err) {
      next(err);
    }
  }

  async getSessionReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.getSessionReport.parseParams<{ id: string }>(req.params);
      const result = await this.service.getSessionReport(id);
      if (result.error) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      res.json(success(result.report));
    } catch (err) {
      next(err);
    }
  }

  async getSessionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.getHistory.parseQuery<SessionHistoryFilters>(req.query);
      const result = await this.service.getSessionHistory(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async forceCloseSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.forceCloseSession.parseParams<{ id: string }>(req.params);
      const result = await this.service.forceCloseSession(id);
      if (result.error) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      logAuditFromReq(req, 'register_force_close', 'register_session', Number(id));

      res.json(success(result.session));
    } catch (err) {
      next(err);
    }
  }
}

export const registerController = new RegisterController();
