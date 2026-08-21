import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { registerService, IRegisterService } from './service';

const openRegisterSchema = z.object({
  opening_float: z.number().min(0, 'Opening float must be non-negative'),
});

const movementSchema = z.object({
  type: z.enum(['cash_in', 'cash_out']),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().max(500).optional(),
});

const closeRegisterSchema = z.object({
  counted_cash: z.number().min(0, 'Counted cash must be non-negative'),
  notes: z.string().max(500).optional(),
});

export class RegisterController {
  constructor(private service: IRegisterService = registerService) {}

  async getCurrentSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;

      const session = await this.service.getCurrentSession(userId);
      res.json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }

  async openSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = openRegisterSchema.parse(req.body);

      const result = await this.service.openSession(userId, parsed.opening_float);
      if (result.error) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'register_open', 'register_session', result.session!.id, {
        opening_float: parsed.opening_float,
      });

      res.json({ success: true, data: result.session! });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async addMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = movementSchema.parse(req.body);

      const result = await this.service.addMovement(
        userId,
        parsed.type,
        parsed.amount,
        parsed.note
      );
      if (result.error) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({ success: true, data: result.movement });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async closeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = closeRegisterSchema.parse(req.body);

      const result = await this.service.closeSession(userId, parsed.counted_cash, parsed.notes);
      if (result.error) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'register_close', 'register_session', result.session!.id, {
        expected_cash: result.session!.expected_cash,
        counted_cash: parsed.counted_cash,
        variance: result.session!.variance,
      });

      res.json({ success: true, data: result.session! });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async getSessionReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await this.service.getSessionReport(id);
      if (result.error) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        data: result.report,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSessionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, cashier_id, from, to } = req.query as Record<
        string,
        string | undefined
      >;

      const result = await this.service.getSessionHistory({
        page: page || '1',
        limit: limit || '25',
        cashier_id,
        from,
        to,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  async forceCloseSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await this.service.forceCloseSession(id);
      if (result.error) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'register_force_close', 'register_session', Number(id));

      res.json({ success: true, data: result.session });
    } catch (err) {
      next(err);
    }
  }
}

export const registerController = new RegisterController();
