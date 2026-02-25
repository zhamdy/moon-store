import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
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
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT c.*, (SELECT COUNT(*) FROM collection_products WHERE collection_id = c.id) as product_count
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
      const result = await db.query(
        `INSERT INTO collections (name, season, year, status, description) VALUES (?, ?, ?, ?, ?) RETURNING *`,
        [
          parsed.name,
          parsed.season || null,
          parsed.year || null,
          parsed.status || 'upcoming',
          parsed.description || null,
        ]
      );
      const colId = result.rows[0].id;
      if (parsed.product_ids?.length) {
        const rawDb = db.db;
        const stmt = rawDb.prepare(
          'INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)'
        );
        parsed.product_ids.forEach((pid, i) => stmt.run(colId, pid, i));
      }
      res.status(201).json({ success: true, data: result.rows[0] });
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
      const result = await db.query(
        `UPDATE collections SET name = ?, season = ?, year = ?, status = ?, description = ? WHERE id = ? RETURNING *`,
        [
          parsed.name,
          parsed.season || null,
          parsed.year || null,
          parsed.status || 'upcoming',
          parsed.description || null,
          id,
        ]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ success: false, error: 'Not found' });
      if (parsed.product_ids) {
        const rawDb = db.db;
        rawDb.prepare('DELETE FROM collection_products WHERE collection_id = ?').run(id);
        const stmt = rawDb.prepare(
          'INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)'
        );
        parsed.product_ids.forEach((pid, i) => stmt.run(id, pid, i));
      }
      res.json({ success: true, data: result.rows[0] });
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
      await db.query('DELETE FROM collections WHERE id = ?', [req.params.id]);
      res.json({ success: true, data: { message: 'Deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/collections/:id
router.get('/:id', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const col = await db.query('SELECT * FROM collections WHERE id = ?', [req.params.id]);
    if (col.rows.length === 0) return res.status(404).json({ success: false, error: 'Not found' });
    const products = await db.query(
      `SELECT p.*, cp.sort_order FROM collection_products cp JOIN products p ON cp.product_id = p.id WHERE cp.collection_id = ? ORDER BY cp.sort_order`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...col.rows[0], products: products.rows } });
  } catch (err) {
    next(err);
  }
});

export default router;
