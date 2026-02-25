import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

const feedbackSchema = z.object({
  sale_id: z.number().int().positive().optional(),
  customer_id: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  nps_score: z.number().int().min(0).max(10).optional(),
  comment: z.string().max(1000).optional(),
});

// GET /api/feedback — List + stats
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const feedback = await db.query(
        `SELECT cf.*, c.name as customer_name
       FROM customer_feedback cf LEFT JOIN customers c ON cf.customer_id = c.id
       ORDER BY cf.created_at DESC LIMIT 100`
      );
      const stats = await db.query(
        `SELECT
        ROUND(AVG(rating), 1) as avg_rating,
        COUNT(*) as total_responses,
        ROUND(
          (CAST(SUM(CASE WHEN nps_score >= 9 THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(nps_score), 0) -
           CAST(SUM(CASE WHEN nps_score <= 6 THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(nps_score), 0)) * 100
        , 0) as nps_score
       FROM customer_feedback`
      );
      res.json({ success: true, data: { feedback: feedback.rows, stats: stats.rows[0] } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/feedback — Submit feedback (public-ish)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = feedbackSchema.parse(req.body);
    const result = await db.query(
      `INSERT INTO customer_feedback (sale_id, customer_id, rating, nps_score, comment) VALUES (?, ?, ?, ?, ?) RETURNING *`,
      [
        parsed.sale_id || null,
        parsed.customer_id || null,
        parsed.rating || null,
        parsed.nps_score || null,
        parsed.comment || null,
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ success: false, error: err.errors[0].message });
    next(err);
  }
});

export default router;
