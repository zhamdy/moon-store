import { Router, Request, Response, NextFunction } from 'express';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';
import { categorySchema } from '../../../validators/categorySchema';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

// GET /api/categories
router.get('/', verifyToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.status = 'active') as product_count
       FROM categories c
       ORDER BY c.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

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
        `INSERT INTO categories (name, code) VALUES ($1, $2) RETURNING *`,
        [name, code]
      );

      logAuditFromReq(req, 'create', 'category', result.rows[0].id as number, { name, code });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        return res.status(409).json({ success: false, error: 'Category code already exists' });
      }
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
        `UPDATE categories SET name = $1, code = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [name, code, req.params.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('UNIQUE') ||
        err.message?.includes('duplicate key')
      ) {
        return res.status(409).json({ success: false, error: 'Category code already exists' });
      }
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
      // Check if category has products
      const countResult = await db.query<{ count: string | number }>(
        'SELECT COUNT(*)::int as count FROM products WHERE category_id = $1',
        [req.params.id]
      );
      if (Number(countResult.rows[0]?.count || 0) > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete category with associated products',
        });
      }

      const result = await db.query('DELETE FROM categories WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Category not found' });
      }

      logAuditFromReq(req, 'delete', 'category', req.params.id as string);
      res.json({ success: true, data: { message: 'Category deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
