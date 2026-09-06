import { Request, Response, NextFunction } from 'express';
import type { LayawayFilters } from './types';
import { layawayRequestContracts, type CreateLayawayBody, type InstallmentBody } from './schemas';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { layawayService, ILayawayService } from './service';
import { PublicError } from '../../../http/errors';
import { paginationMeta } from '../../../http/pagination';
import { success } from '../../../http/responses';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = layawayRequestContracts;

export class LayawayController {
  constructor(private service: ILayawayService = layawayService) {}

  async createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = contracts.createPlan.parseBody<CreateLayawayBody>(req.body);

      const plan = await this.service.createPlan(parsed, authReq.user!.id);

      logAuditFromReq(req, 'create', 'layaway', plan.id, { plan_number: plan.plan_number });
      res.status(201).json(success(plan));
    } catch (err) {
      next(err instanceof z.ZodError ? err : this.mapDomainError(err));
    }
  }

  async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listPlans.parseQuery<LayawayFilters>(req.query);
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
      const { id } = contracts.getPlan.parseParams<{ id: string }>(req.params);
      const plan = await this.service.getPlanById(id);

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
      const id = Number(contracts.payInstallment.parseParams<{ id: string }>(req.params).id);
      const parsed = contracts.payInstallment.parseBody<InstallmentBody>(req.body);

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
      const id = Number(contracts.cancelPlan.parseParams<{ id: string }>(req.params).id);
      const result = await this.service.cancelPlan(id);

      logAuditFromReq(req, 'cancel', 'layaway', id);
      res.json(success(result));
    } catch (err) {
      next(this.mapDomainError(err));
    }
  }

  /**
   * The service now throws `PublicError` with the status it means (#47), so there is
   * nothing here to map. This used to guess from the wording — `includes('not found')`
   * chose 404, anything else 400 — which made every message string a load-bearing part of
   * the API: rewording "Plan not found" to "No such plan" silently turned a 404 into a
   * 400. Passing a PublicError through this now would double-wrap it and *lose* the code
   * it already carries.
   */
  private mapDomainError(error: unknown): unknown {
    return error;
  }
}

export const layawayController = new LayawayController();
