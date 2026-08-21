import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { collectionsService } from './service';

const collectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  season: z.string().max(50).optional(),
  is_featured: z.boolean().optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
});

export class CollectionsController {
  async getCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { season, featured } = req.query;
      const data = await collectionsService.list({
        season: season as string | undefined,
        featured: featured as string | undefined,
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getCollectionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const collection = await collectionsService.findById(req.params.id as string);
      if (!collection) {
        res.status(404).json({ success: false, error: 'Collection not found' });
        return;
      }

      res.json({
        success: true,
        data: collection,
      });
    } catch (err) {
      next(err);
    }
  }

  async createCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = collectionSchema.parse(req.body);
      const collection = await collectionsService.create(parsed);

      logAuditFromReq(req, 'create', 'collection', collection.id, { name: parsed.name });
      res.status(201).json({ success: true, data: collection });
    } catch (err: any) {
      if (err.name === 'ZodError' || err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async updateCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = collectionSchema.parse(req.body);

      const result = await collectionsService.update(id as string, parsed);
      if (!result.success) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'update', 'collection', Number(id));
      res.json({ success: true, data: result.data });
    } catch (err: any) {
      if (err.name === 'ZodError' || err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async deleteCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await collectionsService.delete(id as string);
      if (!result.success) {
        res.status(404).json({ success: false, error: result.error });
        return;
      }

      logAuditFromReq(req, 'delete', 'collection', Number(id));
      res.json({ success: true, data: { message: 'Collection deleted' } });
    } catch (err) {
      next(err);
    }
  }
}

export const collectionsController = new CollectionsController();
