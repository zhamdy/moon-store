import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { collectionsService } from './service';
import { parseCollectionListQuery, CollectionConflictError } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

// Kept in sync with the client's `statuses` enum in Collections.tsx.
const collectionStatusSchema = z.enum(['upcoming', 'active', 'on_sale', 'archived']);

export const collectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  season: z.string().max(50).optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  status: collectionStatusSchema.optional(),
  is_featured: z.boolean().optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
});

/**
 * The update body is a genuine partial, and deliberately not the create schema.
 *
 * `PUT /api/v1/collections/:id` is PATCH-style: a field the body omits is left alone, a
 * field it sets to `null` is cleared. Re-using the create schema here is what caused #78 —
 * every field was optional, so an omitted `is_featured` parsed cleanly and was then written
 * back as the default. The distinction the schema has to carry is *absent* vs *explicitly
 * null*, which is why the nullable columns are `.nullable().optional()` and `name` — a
 * NOT NULL column — is only `.optional()`.
 *
 * PATCH-style rather than requiring a whole record because the client is already written as
 * if this were true: `resource().useSave` PUTs exactly the keys a page put in its draft, so
 * every page in the app sends a partial body. Demanding a full record would have meant every
 * caller learning every column — the same coupling, moved rather than removed.
 *
 * `year` and `status` (#83): the modal has always sent both, and the server had nowhere
 * to put either — `year` had no column at all, and `status`, though it has had a column
 * since 001_initial_schema.sql, was never in this schema or in `repository.update`'s
 * write set. Zod stripped the unknown key before the repository ever saw it, so the
 * request returned a normal 200 with the change silently discarded.
 *
 * `.strict()` on this schema specifically: an unknown field is now a 400 at the moment a
 * client/schema mismatch is introduced, rather than a silent no-op discovered by a user
 * days later. Scoped to this one schema rather than repo-wide — a global sweep is its own
 * change with its own blast radius.
 */
export const collectionUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    season: z.string().max(50).nullable().optional(),
    year: z.number().int().min(1900).max(2100).nullable().optional(),
    status: collectionStatusSchema.optional(),
    is_featured: z.boolean().optional(),
    product_ids: z.array(z.number().int().positive()).optional(),
    // The `updated_at` the caller read (#81). Validated as a datetime here so a
    // malformed value is a 400 from the schema rather than a cast error from the
    // database; whether it is *current* is decided under the row lock in the service.
    expected_updated_at: z.string().datetime().optional(),
  })
  .strict();

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
      const parsed = collectionUpdateSchema.parse(req.body);

      const result = await collectionsService.update(id as string, parsed);
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
