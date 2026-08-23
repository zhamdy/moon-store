import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { collectionsService } from './service';
import { parseCollectionListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

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
      const query = parseCollectionListQuery(req.query);
      const result = await collectionsService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async getCollectionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const collection = await collectionsService.findById(req.params.id as string);
      if (!collection) {
        throw new PublicError('NOT_FOUND', 'Collection not found');
      }

      res.json(success(collection));
    } catch (err) {
      next(err);
    }
  }

  async createCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = collectionSchema.parse(req.body);
      const collection = await collectionsService.create(parsed);

      logAuditFromReq(req, 'create', 'collection', collection.id, { name: parsed.name });
      res.status(201).json(success(collection));
    } catch (err) {
      next(err);
    }
  }

  async updateCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = collectionSchema.parse(req.body);

      const result = await collectionsService.update(id as string, parsed);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      logAuditFromReq(req, 'update', 'collection', Number(id));
      res.json(success(result.data));
    } catch (err) {
      next(err);
    }
  }

  async deleteCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await collectionsService.delete(id as string);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      logAuditFromReq(req, 'delete', 'collection', Number(id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const collectionsController = new CollectionsController();
