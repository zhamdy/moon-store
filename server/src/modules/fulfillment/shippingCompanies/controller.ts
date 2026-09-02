import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { shippingCompaniesService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

const shippingCompanySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().nullable(),
  tracking_url_template: z.string().max(255).optional(),
  is_active: z.boolean().default(true),
});

/**
 * The update body is a genuine partial — same reasoning as #78 on collections, and this is
 * one of the modules where it was losing data today.
 *
 * `ShippingCompaniesDialog` sends `{ name, phone, website }`. Re-using the create schema
 * meant `email` and `tracking_url_template` were absent-but-valid and got written back as
 * NULL, and `is_active`'s `.default(true)` reactivated a company someone had disabled.
 */
export const shippingCompanyUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  tracking_url_template: z.string().max(255).nullable().optional(),
  is_active: z.boolean().optional(),
});

export class ShippingCompaniesController {
  async getShippingCompanies(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await shippingCompaniesService.list();
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }

  async createShippingCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = shippingCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const created = await shippingCompaniesService.create(parsed.data);

      logAuditFromReq(req, 'create', 'shipping_company', created.id as number, {
        name: parsed.data.name,
      });

      res.status(201).json(success(created));
    } catch (err) {
      next(err);
    }
  }

  async updateShippingCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = shippingCompanyUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const updated = await shippingCompaniesService.update(id as string, parsed.data);
      if (!updated) {
        throw new PublicError('NOT_FOUND', 'Shipping company not found');
      }

      logAuditFromReq(req, 'update', 'shipping_company', Number(id));
      res.json(success(updated));
    } catch (err) {
      next(err);
    }
  }

  async deleteShippingCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await shippingCompaniesService.delete(id as string);
      if (!deleted) {
        throw new PublicError('NOT_FOUND', 'Shipping company not found');
      }

      logAuditFromReq(req, 'delete', 'shipping_company', Number(id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const shippingCompaniesController = new ShippingCompaniesController();
