import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  vendorsRequestContracts,
  vendorSchema,
  vendorUpdateSchema,
  type VendorPayoutBody,
} from './schemas';
import type { VendorFilters, VendorPayoutFilters } from './types';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { vendorsService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = vendorsRequestContracts;

export class VendorsController {
  async listVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listVendors.parseQuery<VendorFilters>(req.query);
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
      const parsed = contracts.createVendor.parseBody<z.infer<typeof vendorSchema>>(req.body);

      const vendor = await vendorsService.create(parsed);
      logAuditFromReq(req, 'create', 'vendor', vendor.id, { name: parsed.name });
      res.status(201).json(success(vendor));
    } catch (err) {
      next(err);
    }
  }

  async updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateVendor.parseParams<{ id: string }>(req.params);
      const parsed = contracts.updateVendor.parseBody<z.infer<typeof vendorUpdateSchema>>(req.body);

      const vendor = await vendorsService.update(id as string, parsed);
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
      const { id } = contracts.listVendorPayouts.parseParams<{ id: string }>(req.params);
      const query = contracts.listVendorPayouts.parseQuery<VendorPayoutFilters>(req.query);
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
      const { id } = contracts.createVendorPayout.parseParams<{ id: string }>(req.params);
      const { amount, period_start, period_end, notes } =
        contracts.createVendorPayout.parseBody<VendorPayoutBody>(req.body);

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
