import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { shiftsService, IShiftsService } from './service';
import { PublicError } from '../../../http/errors';
import { paginationMeta } from '../../../http/pagination';
import { success } from '../../../http/responses';
import { parseShiftListQuery } from './types';

const clockInSchema = z.object({
  branch_id: z.number().int().positive().optional(),
  notes: z.string().max(255).optional(),
});

const clockOutSchema = z.object({
  notes: z.string().max(255).optional(),
});

export class ShiftsController {
  constructor(private service: IShiftsService = shiftsService) {}

  async getCurrentShift(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const shift = await this.service.getCurrentShift(authReq.user!.id);
      res.json(success(shift));
    } catch (err) {
      next(err);
    }
  }

  async clockIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = clockInSchema.parse(req.body);

      const shift = await this.service.clockIn(authReq.user!.id, parsed);

      logAuditFromReq(req, 'clock_in', 'shift', shift.id);
      res.status(201).json(success(shift));
    } catch (err) {
      next(err instanceof z.ZodError ? err : this.toValidationError(err));
    }
  }

  async clockOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = clockOutSchema.parse(req.body);

      const shift = await this.service.clockOut(authReq.user!.id, parsed);

      logAuditFromReq(req, 'clock_out', 'shift', shift.id);
      res.json(success(shift));
    } catch (err) {
      next(err instanceof z.ZodError ? err : this.toValidationError(err));
    }
  }

  async startBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const shift = await this.service.startBreak(authReq.user!.id);
      res.json(success(shift));
    } catch (err) {
      next(this.toValidationError(err));
    }
  }

  async endBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const shift = await this.service.endBreak(authReq.user!.id);
      res.json(success(shift));
    } catch (err) {
      next(this.toValidationError(err));
    }
  }

  async getShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const query = parseShiftListQuery(req.query);
      const result = await this.service.listShifts(authReq.user!.role, authReq.user!.id, query);

      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  private toValidationError(error: unknown): unknown {
    return error instanceof Error ? new PublicError('VALIDATION_ERROR', error.message) : error;
  }
}

export const shiftsController = new ShiftsController();
