import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  shippingCompaniesRequestContracts,
  shippingCompanySchema,
  shippingCompanyUpdateSchema,
} from './schemas';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { shippingCompaniesService } from './service';
import { success } from '../../../http/responses';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = shippingCompaniesRequestContracts;

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
      const parsed = contracts.createShippingCompany.parseBody<
        z.infer<typeof shippingCompanySchema>
      >(req.body);

      const created = await shippingCompaniesService.create(parsed);

      logAuditFromReq(req, 'create', 'shipping_company', created.id as number, {
        name: parsed.name,
      });

      res.status(201).json(success(created));
    } catch (err) {
      next(err);
    }
  }

  async updateShippingCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateShippingCompany.parseParams<{ id: string }>(req.params);
      const parsed = contracts.updateShippingCompany.parseBody<
        z.infer<typeof shippingCompanyUpdateSchema>
      >(req.body);

      const updated = await shippingCompaniesService.update(id as string, parsed);
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
      const { id } = contracts.deleteShippingCompany.parseParams<{ id: string }>(req.params);
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
