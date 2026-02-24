import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

const claimSchema = z.object({
  sale_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  customer_id: z.number().int().positive().optional(),
  issue: z.string().min(1).max(1000),
});

// GET /api/warranty
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.query;
      let where = '1=1';
      const params: unknown[] = [];
      if (status) {
        where += ' AND wc.status = ?';
        params.push(status);
      }

      const result = await db.query(
        `SELECT wc.*, p.name as product_name, c.name as customer_name
       FROM warranty_claims wc
       JOIN products p ON wc.product_id = p.id
       LEFT JOIN customers c ON wc.customer_id = c.id
       WHERE ${where}
       ORDER BY wc.created_at DESC`,
        params
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/warranty
router.post('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = claimSchema.parse(req.body);
    const result = await db.query(
      `INSERT INTO warranty_claims (sale_id, product_id, customer_id, issue) VALUES (?, ?, ?, ?) RETURNING *`,
      [parsed.sale_id, parsed.product_id, parsed.customer_id || null, parsed.issue]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ success: false, error: err.errors[0].message });
    next(err);
  }
});

// PUT /api/warranty/:id/status
router.put(
  '/:id/status',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, resolution } = req.body;
      const result = await db.query(
        `UPDATE warranty_claims SET status = ?, resolution = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`,
        [status, resolution || null, req.params.id]
      );
      if (result.rows.length === 0)
        return res.status(404).json({ success: false, error: 'Not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
