import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { vendorsService } from './service';

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
      const { status, page = '1', limit = '20', search } = req.query;

      const result = await vendorsService.list({
        status: status as string | undefined,
        page: Number(page),
        limit: Number(limit),
        search: search as string | undefined,
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

  async createVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = vendorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const vendor = await vendorsService.create(parsed.data);
      logAuditFromReq(req, 'create', 'vendor', vendor.id, { name: parsed.data.name });
      res.status(201).json({ success: true, data: vendor });
    } catch (err) {
      next(err);
    }
  }

  async updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = vendorSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const vendor = await vendorsService.update(id as string, parsed.data);
      if (!vendor) {
        res.status(404).json({ success: false, error: 'Vendor not found' });
        return;
      }

      logAuditFromReq(req, 'update', 'vendor', Number(id));
      res.json({ success: true, data: vendor });
    } catch (err) {
      next(err);
    }
  }

  async getPayouts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const payouts = await vendorsService.getPayouts(id as string);
      res.json({ success: true, data: payouts });
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
        res.status(400).json({ success: false, error: 'Valid payout amount required' });
        return;
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

      res.status(201).json({ success: true, data: payout });
    } catch (err) {
      next(err);
    }
  }
}

export const vendorsController = new VendorsController();
