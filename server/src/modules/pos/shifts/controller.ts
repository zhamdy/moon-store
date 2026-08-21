import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { shiftsService, IShiftsService } from './service';

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
      res.json({ success: true, data: shift });
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
      res.status(201).json({ success: true, data: shift });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      if (err.message === 'Already clocked in') {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async clockOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = clockOutSchema.parse(req.body);

      const shift = await this.service.clockOut(authReq.user!.id, parsed);

      logAuditFromReq(req, 'clock_out', 'shift', shift.id);
      res.json({ success: true, data: shift });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      if (err.message === 'No active shift found') {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async startBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const shift = await this.service.startBreak(authReq.user!.id);
      res.json({ success: true, data: shift });
    } catch (err: any) {
      if (err.message === 'No active shift to start break') {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async endBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const shift = await this.service.endBreak(authReq.user!.id);
      res.json({ success: true, data: shift });
    } catch (err: any) {
      if (err.message === 'Not currently on break') {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async getShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const result = await this.service.listShifts(
        authReq.user!.role,
        authReq.user!.id,
        req.query
      );

      res.json({
        success: true,
        data: result.rows,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const shiftsController = new ShiftsController();
