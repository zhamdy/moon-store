import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';

const router: Router = Router();

const feedbackSchema = z.object({
  customer_id: z.number().int().positive().optional(),
  sale_id: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5),
  category: z
    .enum(['service', 'product_quality', 'pricing', 'store_ambiance', 'general'])
    .default('general'),
  comment: z.string().max(500).optional(),
});

// POST /api/feedback — Submit customer feedback (public or POS)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = feedbackSchema.parse(req.body);

    const result = await db.query(
      `INSERT INTO customer_feedback (customer_id, sale_id, rating, category, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        parsed.customer_id || null,
        parsed.sale_id || null,
        parsed.rating,
        parsed.category,
        parsed.comment || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// GET /api/feedback — List feedback (Admin)
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { rating, category, page = '1', limit = '20' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const params: unknown[] = [];
      let where = 'WHERE 1=1';

      if (rating) {
        params.push(Number(rating));
        where += ` AND f.rating = $${params.length}`;
      }
      if (category) {
        params.push(category);
        where += ` AND f.category = $${params.length}`;
      }

      const countResult = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int as total FROM customer_feedback f ${where}`,
        params
      );

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const feedback = await db.query(
        `SELECT f.*, c.name as customer_name, c.phone as customer_phone
         FROM customer_feedback f
         LEFT JOIN customers c ON f.customer_id = c.id
         ${where}
         ORDER BY f.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, Number(limit), offset]
      );

      // Summary stats
      const stats = await db.query(
        `SELECT
          ROUND(AVG(rating)::numeric, 1) as avg_rating,
          COUNT(*)::int as total_count,
          SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END)::int as positive_count,
          SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END)::int as negative_count
         FROM customer_feedback`
      );

      res.json({
        success: true,
        data: feedback.rows,
        stats: stats.rows[0],
        meta: {
          total: Number(countResult.rows[0]?.total || 0),
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
