import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

const collectionSchema = z.object({
  name: z.string().min(1).max(200),
  season: z.enum(['Spring', 'Summer', 'Fall', 'Winter']).optional(),
  year: z.number().int().optional(),
  status: z.enum(['upcoming', 'active', 'on_sale', 'archived']).optional(),
  description: z.string().max(1000).optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
});

// GET /api/collections
router.get('/', verifyToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT c.*, (SELECT COUNT(*)::int FROM collection_products WHERE collection_id = c.id) as product_count
       FROM collections c ORDER BY c.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
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
        const colRes = await client.query(
          `INSERT INTO collections (name, season, year, status, description) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [
            parsed.name,
            parsed.season || null,
            parsed.year || null,
            parsed.status || 'upcoming',
            parsed.description || null,
          ]
        );
        const col = colRes.rows[0];
        if (parsed.product_ids?.length) {
          for (let i = 0; i < parsed.product_ids.length; i++) {
            const pid = parsed.product_ids[i];
            await client.query(
              'INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT (collection_id, product_id) DO NOTHING',
              [col.id, pid, i]
            );
          }
        }
        return col;
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ success: false, error: err.errors[0].message });
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
      const parsed = collectionSchema.parse(req.body);
      const { id } = req.params;
      const result = await withTransaction(async (client) => {
        const colRes = await client.query(
          `UPDATE collections SET name = $1, season = $2, year = $3, status = $4, description = $5 WHERE id = $6 RETURNING *`,
          [
            parsed.name,
            parsed.season || null,
            parsed.year || null,
            parsed.status || 'upcoming',
            parsed.description || null,
            id,
          ]
        );
        if (colRes.rows.length === 0) {
          return null;
        }
        if (parsed.product_ids) {
          await client.query('DELETE FROM collection_products WHERE collection_id = $1', [id]);
          for (let i = 0; i < parsed.product_ids.length; i++) {
            const pid = parsed.product_ids[i];
            await client.query(
              'INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES ($1, $2, $3) ON CONFLICT (collection_id, product_id) DO NOTHING',
              [id, pid, i]
            );
          }
        }
        return colRes.rows[0];
      });

      if (!result) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      res.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ success: false, error: err.errors[0].message });
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
      await db.query('DELETE FROM collections WHERE id = $1', [req.params.id]);
      res.json({ success: true, data: { message: 'Deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/collections/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const col = await db.query('SELECT * FROM collections WHERE id = $1', [req.params.id]);
    if (col.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    const products = await db.query(
      `SELECT p.*, cp.sort_order FROM collection_products cp JOIN products p ON cp.product_id = p.id WHERE cp.collection_id = $1 ORDER BY cp.sort_order`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...col.rows[0], products: products.rows } });
  } catch (err) {
    next(err);
  }
});

export default router;
