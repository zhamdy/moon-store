import { Router, Request, Response, NextFunction } from 'express';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';

const router: Router = Router();

// GET /api/stock-adjustments -- list all stock adjustments (most recent first)
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const countResult = await db.query<{ count: string | number }>(
        'SELECT COUNT(*)::int as count FROM stock_adjustments'
      );
      const total = Number(countResult.rows[0]?.count || 0);

      const result = await db.query(
        `SELECT sa.*, p.name as product_name, p.sku as product_sku, u.name as user_name
         FROM stock_adjustments sa
         LEFT JOIN products p ON sa.product_id = p.id
         LEFT JOIN users u ON sa.user_id = u.id
         ORDER BY sa.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limitNum, offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total, page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
