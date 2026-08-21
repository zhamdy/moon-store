import { Router, Request, Response, NextFunction } from 'express';
import db from '../src/database/pool';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

// GET /api/stock-adjustments — global log
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { product_id, user_id, reason, page = 1, limit = 50 } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = [];
      const params: unknown[] = [];

      if (product_id) {
        params.push(product_id);
        where.push(`sa.product_id = $${params.length}`);
      }
      if (user_id) {
        params.push(user_id);
        where.push(`sa.user_id = $${params.length}`);
      }
      if (reason) {
        params.push(reason);
        where.push(`sa.reason = $${params.length}`);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM stock_adjustments sa ${whereClause}`,
        params
      );

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;
      const result = await db.query(
        `SELECT sa.*, p.name as product_name, p.sku as product_sku, u.name as user_name
         FROM stock_adjustments sa
         LEFT JOIN products p ON sa.product_id = p.id
         LEFT JOIN users u ON sa.user_id = u.id
         ${whereClause}
         ORDER BY sa.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limitNum, offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total: Number(countResult.rows[0]?.count || 0), page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
