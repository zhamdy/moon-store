import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { warrantyService } from './service';

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
      const { status, page = '1', limit = '20' } = req.query;

      const result = await warrantyService.list({
        status: status as string | undefined,
        page: Number(page),
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async createClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = warrantyClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const claim = await warrantyService.create(parsed.data);
      logAuditFromReq(req, 'create', 'warranty_claim', claim.id);
      res.status(201).json({ success: true, data: claim });
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
        res.status(404).json({ success: false, error: 'Warranty claim not found' });
        return;
      }

      logAuditFromReq(req, 'update', 'warranty_claim', Number(id));
      res.json({ success: true, data: claim });
    } catch (err) {
      next(err);
    }
  }
}

export const warrantyController = new WarrantyController();
