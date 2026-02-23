import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';
import { categorySchema } from '../validators/categorySchema';

const router: Router = Router();

// GET /api/categories
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search } = req.query;
      let query = 'SELECT * FROM categories';
      const params: unknown[] = [];

      if (search) {
        query += ' WHERE name LIKE ? OR code LIKE ?';
        const s = `%${search}%`;
        params.push(s, s);
      }

      query += ' ORDER BY name';

      const result = await db.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/categories/:id
router.get(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/categories
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, code } = parsed.data;
      const result = await db.query(
        `INSERT INTO categories (name, code) VALUES (?, ?) RETURNING *`,
        [name, code]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/categories/:id
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      }

      const { name, code } = parsed.data;
      const result = await db.query(
        `UPDATE categories SET name=?, code=?, updated_at=datetime('now') WHERE id=? RETURNING *`,
        [name, code, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/categories/:id
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if any products reference this category
      const refs = await db.query<{ count: number }>(
        'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
        [req.params.id]
      );
      if (refs.rows[0].count > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete: ${refs.rows[0].count} product(s) reference this category`,
        });
      }

      const result = await db.query('DELETE FROM categories WHERE id = ? RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }
      res.json({ success: true, data: { message: 'Category deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
