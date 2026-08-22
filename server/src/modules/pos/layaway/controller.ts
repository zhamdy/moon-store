import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { layawayService, ILayawayService } from './service';
import { PublicError } from '../../../http/errors';
import { paginationMeta } from '../../../http/pagination';
import { success } from '../../../http/responses';
import { parseLayawayListQuery } from './types';

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
      res.status(201).json(success(plan));
    } catch (err) {
      next(err instanceof z.ZodError ? err : this.mapDomainError(err));
    }
  }

  async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseLayawayListQuery(req.query);
      const result = await this.service.listPlans(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getPlanById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await this.service.getPlanById(req.params.id as string);

      if (!plan) {
        throw new PublicError('NOT_FOUND', 'Layaway plan not found');
      }
      res.json(success(plan));
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

      res.json(success(result));
    } catch (err) {
      next(err instanceof z.ZodError ? err : this.mapDomainError(err));
    }
  }

  async cancelPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Number(req.params.id);
      const result = await this.service.cancelPlan(id);

      logAuditFromReq(req, 'cancel', 'layaway', id);
      res.json(success(result));
    } catch (err) {
      next(this.mapDomainError(err));
    }
  }

  private mapDomainError(error: unknown): unknown {
    if (!(error instanceof Error)) return error;
    return new PublicError(
      error.message.includes('not found') ? 'NOT_FOUND' : 'VALIDATION_ERROR',
      error.message
    );
  }
}

export const layawayController = new LayawayController();
