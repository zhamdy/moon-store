import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { withTransaction } from '../../database/transaction';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const collectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  season: z.string().max(50).optional(),
  is_featured: z.boolean().optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
});

// GET /api/collections
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { season, featured } = req.query;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (season) {
      params.push(season);
      where += ` AND c.season = $${params.length}`;
    }
    if (featured === 'true') {
      where += ' AND c.is_featured = 1';
    }

    const collections = await db.query(
      `SELECT c.*,
        (SELECT COUNT(*)::int FROM collection_products WHERE collection_id = c.id) as product_count
       FROM collections c
       ${where}
       ORDER BY c.is_featured DESC, c.created_at DESC`,
      params
    );

    res.json({ success: true, data: collections.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/collections/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const collection = await db.query('SELECT * FROM collections WHERE id = $1', [id]);
    if (collection.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Collection not found' });
    }

    const products = await db.query(
      `SELECT p.*, cp.position
       FROM collection_products cp
       JOIN products p ON cp.product_id = p.id
       WHERE cp.collection_id = $1
       ORDER BY cp.position ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...collection.rows[0],
        products: products.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/collections
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = collectionSchema.parse(req.body);

      const result = await withTransaction(async (client) => {
        const cResult = await client.query(
          `INSERT INTO collections (name, description, season, is_featured)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [
            parsed.name,
            parsed.description || null,
            parsed.season || null,
            parsed.is_featured ? 1 : 0,
          ]
        );
        const collection = cResult.rows[0];

        if (parsed.product_ids && parsed.product_ids.length > 0) {
          for (let i = 0; i < parsed.product_ids.length; i++) {
            await client.query(
              `INSERT INTO collection_products (collection_id, product_id, position)
               VALUES ($1, $2, $3)`,
              [collection.id, parsed.product_ids[i], i]
            );
          }
        }

        return collection;
      });

      logAuditFromReq(req, 'create', 'collection', result.id as number, { name: parsed.name });
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// PUT /api/collections/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = collectionSchema.parse(req.body);

      const existing = await db.query('SELECT * FROM collections WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Collection not found' });
      }

      const result = await withTransaction(async (client) => {
        const cResult = await client.query(
          `UPDATE collections SET name = $1, description = $2, season = $3, is_featured = $4, updated_at = NOW()
           WHERE id = $5 RETURNING *`,
          [
            parsed.name,
            parsed.description || null,
            parsed.season || null,
            parsed.is_featured ? 1 : 0,
            id,
          ]
        );

        if (parsed.product_ids !== undefined) {
          await client.query('DELETE FROM collection_products WHERE collection_id = $1', [id]);
          for (let i = 0; i < parsed.product_ids.length; i++) {
            await client.query(
              `INSERT INTO collection_products (collection_id, product_id, position)
               VALUES ($1, $2, $3)`,
              [id, parsed.product_ids[i], i]
            );
          }
        }

        return cResult.rows[0];
      });

      logAuditFromReq(req, 'update', 'collection', Number(id));
      res.json({ success: true, data: result });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// DELETE /api/collections/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await db.query('DELETE FROM collections WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Collection not found' });
      }
      logAuditFromReq(req, 'delete', 'collection', Number(id));
      res.json({ success: true, data: { message: 'Collection deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
