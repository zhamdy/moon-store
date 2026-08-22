import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { bundlesService } from './service';
import { parseBundleListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

const bundleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  bundle_price: z.number().positive(),
  starts_at: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
      })
    )
    .min(2, 'A bundle must contain at least 2 products'),
});

export class BundlesController {
  async getBundles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = parseBundleListQuery(req.query);
      const result = await bundlesService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getBundleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bundle = await bundlesService.findById(req.params.id as string);
      if (!bundle) {
        throw new PublicError('NOT_FOUND', 'Bundle not found');
      }

      res.json(success(bundle));
    } catch (err) {
      next(err);
    }
  }

  async createBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = bundleSchema.parse(req.body);
      const bundle = await bundlesService.create(parsed);

      logAuditFromReq(req, 'create', 'bundle', bundle.id, { name: parsed.name });
      res.status(201).json(success(bundle));
    } catch (err) {
      next(err);
    }
  }

  async updateBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = bundleSchema.parse(req.body);

      const result = await bundlesService.update(id as string, parsed);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      logAuditFromReq(req, 'update', 'bundle', Number(id));
      res.json(success(result.data));
    } catch (err) {
      next(err);
    }
  }

  async deleteBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await bundlesService.delete(id as string);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      logAuditFromReq(req, 'delete', 'bundle', Number(id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const bundlesController = new BundlesController();
