import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { shippingCompaniesService } from './service';

const shippingCompanySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().nullable(),
  tracking_url_template: z.string().max(255).optional(),
  is_active: z.boolean().default(true),
});

export class ShippingCompaniesController {
  async getShippingCompanies(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await shippingCompaniesService.list();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createShippingCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = shippingCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const created = await shippingCompaniesService.create(parsed.data);

      logAuditFromReq(req, 'create', 'shipping_company', created.id as number, {
        name: parsed.data.name,
      });

      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  }

  async updateShippingCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = shippingCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const updated = await shippingCompaniesService.update(id as string, parsed.data);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Shipping company not found' });
        return;
      }

      logAuditFromReq(req, 'update', 'shipping_company', Number(id));
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async deleteShippingCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await shippingCompaniesService.delete(id as string);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Shipping company not found' });
        return;
      }

      logAuditFromReq(req, 'delete', 'shipping_company', Number(id));
      res.json({ success: true, data: { message: 'Shipping company deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const shippingCompaniesController = new ShippingCompaniesController();
