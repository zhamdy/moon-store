import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { bundlesService } from './service';

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
      const { status, page = '1', limit = '20' } = req.query;
      const result = await bundlesService.list({
        status: status as string | undefined,
        page: Number(page),
        limit: Number(limit),
      });

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total: result.total,
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getBundleById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bundle = await bundlesService.findById(req.params.id as string);
      if (!bundle) {
        res.status(404).json({ success: false, error: 'Bundle not found' });
        return;
      }

      res.json({
        success: true,
        data: bundle,
      });
    } catch (err) {
      next(err);
    }
  }

  async createBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = bundleSchema.parse(req.body);
      const bundle = await bundlesService.create(parsed);

      logAuditFromReq(req, 'create', 'bundle', bundle.id, { name: parsed.name });
      res.status(201).json({ success: true, data: bundle });
    } catch (err: any) {
      if (err.name === 'ZodError' || err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async updateBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = bundleSchema.parse(req.body);

      const result = await bundlesService.update(id as string, parsed);
      if (!result.success) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'update', 'bundle', Number(id));
      res.json({ success: true, data: result.data });
    } catch (err: any) {
      if (err.name === 'ZodError' || err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async deleteBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await bundlesService.delete(id as string);
      if (!result.success) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'delete', 'bundle', Number(id));
      res.json({ success: true, data: { message: 'Bundle deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const bundlesController = new BundlesController();
