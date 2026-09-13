import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { warrantyRequestContracts, warrantyClaimSchema, type WarrantyUpdateBody } from './schemas';
import type { WarrantyFilters } from './types';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { warrantyService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = warrantyRequestContracts;

export class WarrantyController {
  async listClaims(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listClaims.parseQuery<WarrantyFilters>(req.query);
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
      const parsed = contracts.createClaim.parseBody<z.infer<typeof warrantyClaimSchema>>(req.body);

      const claim = await warrantyService.create(parsed);
      logAuditFromReq(req, 'create', 'warranty_claim', claim.id);
      res.status(201).json(success(claim));
    } catch (err) {
      next(err);
    }
  }

  async updateClaim(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.updateClaim.parseParams<{ id: string }>(req.params);
      const { status, resolution } = contracts.updateClaim.parseBody<WarrantyUpdateBody>(req.body);

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
