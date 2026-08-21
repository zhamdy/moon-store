import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { layawayService, ILayawayService } from './service';

const createLayawaySchema = z.object({
  customer_id: z.number().int().positive(),
  total_amount: z.number().positive(),
  deposit_amount: z.number().positive(),
  payment_method: z.enum(['cash', 'card']).default('cash'),
  due_date: z.string(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive().optional().nullable(),
        quantity: z.number().int().positive(),
        price: z.number().min(0),
      })
    )
    .min(1),
});

const installmentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.enum(['cash', 'card']).default('cash'),
  notes: z.string().max(255).optional(),
});

export class LayawayController {
  constructor(private service: ILayawayService = layawayService) {}

  async createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = createLayawaySchema.parse(req.body);

      const plan = await this.service.createPlan(parsed, authReq.user!.id);

      logAuditFromReq(req, 'create', 'layaway', plan.id, { plan_number: plan.plan_number });
      res.status(201).json({ success: true, data: plan });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      if (err.message === 'Deposit cannot equal or exceed total amount') {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page = '1', limit = '20', search } = req.query;
      const result = await this.service.listPlans({
        status: status as string | undefined,
        page: page as string,
        limit: limit as string,
        search: search as string | undefined,
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

  async getPlanById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.service.getPlanById(req.params.id as string);

      if (!plan) {
        res.status(404).json({ success: false, error: 'Layaway plan not found' });
        return;
      }

      res.json({
        success: true,
        data: plan,
      });
    } catch (err) {
      next(err);
    }
  }

  async payInstallment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const id = Number(req.params.id);
      const parsed = installmentSchema.parse(req.body);

      const result = await this.service.recordPayment(id, parsed, authReq.user!.id);

      logAuditFromReq(req, 'payment', 'layaway', id, {
        amount: parsed.amount,
        remaining: result.remaining_balance,
        completed: result.status === 'completed',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      if (err.message === 'Plan not found') {
        res.status(404).json({ success: false, error: err.message });
        return;
      }
      if (err.message === 'Plan is not active' || err.message?.includes('exceeds remaining balance')) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }

  async cancelPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const result = await this.service.cancelPlan(id);

      logAuditFromReq(req, 'cancel', 'layaway', id);
      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err.message === 'Plan not found') {
        res.status(404).json({ success: false, error: err.message });
        return;
      }
      if (err.message === 'Only active plans can be cancelled') {
        res.status(400).json({ success: false, error: err.message });
        return;
      }
      next(err);
    }
  }
}

export const layawayController = new LayawayController();
