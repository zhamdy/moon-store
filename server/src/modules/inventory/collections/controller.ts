import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { collectionsService } from './service';
import { collectionSchema, collectionUpdateSchema, collectionsRequestContracts } from './schemas';
import { normalizeCollectionListQuery, CollectionConflictError } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = collectionsRequestContracts;

export class CollectionsController {
  async getCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = normalizeCollectionListQuery(contracts.listCollections.parseQuery(req.query));
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
      const { id } = contracts.getCollection.parseParams<{ id: string }>(req.params);
      const collection = await collectionsService.findById(id);
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
      const parsed = contracts.createCollection.parseBody<z.infer<typeof collectionSchema>>(
        req.body
      );
      const collection = await collectionsService.create(parsed);

      logAuditFromReq(req, 'create', 'collection', collection.id, { name: parsed.name });
      res.status(201).json(success(collection));
    } catch (err) {
      next(err);
    }
  }

  async updateCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.updateCollection.parseBody<z.infer<typeof collectionUpdateSchema>>(
        req.body
      );
      const { id } = contracts.updateCollection.parseParams<{ id: string }>(req.params);

      const result = await collectionsService.update(id, parsed);
      if (!result.success) {
        throw new PublicError('NOT_FOUND', result.error);
      }

      logAuditFromReq(req, 'update', 'collection', Number(id));
      res.json(success(result.data));
    } catch (err) {
      if (err instanceof CollectionConflictError) {
        // The envelope code stays one of the seven public ones; the domain code rides
        // in `details[]`, where `IDEMPOTENCY_KEY_REUSED` and `INSUFFICIENT_STOCK`
        // already ride. `field` names the request key the client must refresh.
        next(
          new PublicError('CONFLICT', err.message, [
            { field: 'expected_updated_at', code: err.code, message: err.message },
          ])
        );
        return;
      }
      next(err);
    }
  }

  async deleteCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = contracts.deleteCollection.parseParams<{ id: string }>(req.params);
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
