import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { warrantyService } from './service';
import { parseWarrantyListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

export const warrantyClaimSchema = z.object({
  sale_id: z.number().int().positive().optional(),
  product_id: z.number().int().positive(),
  customer_id: z.number().int().positive().optional(),
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().min(1).max(30),
  issue_description: z.string().min(1).max(500),
  resolution: z.string().max(500).optional(),
});

export class WarrantyController {
  async listClaims(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseWarrantyListQuery(req.query);
      const result = await warrantyService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = warrantyClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const claim = await warrantyService.create(parsed.data);
      logAuditFromReq(req, 'create', 'warranty_claim', claim.id);
      res.status(201).json(success(claim));
    } catch (err) {
      next(err);
    }
  }

  async updateClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, resolution } = req.body;

      const claim = await warrantyService.update(id as string, {
        status: status || undefined,
        resolution: resolution || undefined,
      });

      if (!claim) {
        throw new PublicError('NOT_FOUND', 'Warranty claim not found');
      }

      logAuditFromReq(req, 'update', 'warranty_claim', Number(id));
      res.json(success(claim));
    } catch (err) {
      next(err);
    }
  }
}

export const warrantyController = new WarrantyController();
