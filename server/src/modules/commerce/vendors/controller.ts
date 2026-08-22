import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { vendorsService } from './service';
import { parseVendorListQuery, parseVendorPayoutQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

export const vendorSchema = z.object({
  name: z.string().min(1).max(100),
  contact_person: z.string().max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional(),
  address: z.string().max(255).optional(),
  tax_number: z.string().max(50).optional(),
  commission_rate: z.number().min(0).max(100).default(0),
  status: z.enum(['active', 'inactive']).default('active'),
});

export class VendorsController {
  async listVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseVendorListQuery(req.query);
      const result = await vendorsService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = vendorSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const vendor = await vendorsService.create(parsed.data);
      logAuditFromReq(req, 'create', 'vendor', vendor.id, { name: parsed.data.name });
      res.status(201).json(success(vendor));
    } catch (err) {
      next(err);
    }
  }

  async updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = vendorSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const vendor = await vendorsService.update(id as string, parsed.data);
      if (!vendor) {
        throw new PublicError('NOT_FOUND', 'Vendor not found');
      }

      logAuditFromReq(req, 'update', 'vendor', Number(id));
      res.json(success(vendor));
    } catch (err) {
      next(err);
    }
  }

  async getPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const query = parseVendorPayoutQuery(req.query);
      const result = await vendorsService.getPayouts(id as string, query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createPayout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { amount, period_start, period_end, notes } = req.body;

      if (!amount || amount <= 0) {
        throw new PublicError('VALIDATION_ERROR', 'Valid payout amount required');
      }

      const payout = await vendorsService.createPayout(
        id as string,
        {
          amount: Number(amount),
          period_start: period_start || null,
          period_end: period_end || null,
          notes: notes || null,
        },
        authReq.user?.id || 0
      );

      res.status(201).json(success(payout));
    } catch (err) {
      next(err);
    }
  }
}

export const vendorsController = new VendorsController();
