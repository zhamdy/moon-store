import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole } from '../middleware/auth';

const router: Router = Router();

// GET /api/audit-log
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        limit = 50,
        user_id,
        action,
        entity_type,
        search,
        date_from,
        date_to,
      } = req.query;
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      const where: string[] = [];
      const params: unknown[] = [];

      if (user_id) {
        where.push(`a.user_id = ?`);
        params.push(Number(user_id));
      }
      if (action) {
        where.push(`a.action = ?`);
        params.push(action);
      }
      if (entity_type) {
        where.push(`a.entity_type = ?`);
        params.push(entity_type);
      }
      if (search) {
        where.push(`(a.entity_id LIKE ? OR a.details LIKE ? OR a.user_name LIKE ?)`);
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      if (date_from) {
        where.push(`a.created_at >= ?`);
        params.push(date_from);
      }
      if (date_to) {
        where.push(`a.created_at <= ?`);
        params.push(date_to + ' 23:59:59');
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM audit_log a ${whereClause}`,
        params
      );
      const total = countResult[0].count;

      const entries = await db.query(
        `SELECT a.*, u.name as user_display_name
         FROM audit_log a
         LEFT JOIN users u ON a.user_id = u.id
         ${whereClause}
         ORDER BY a.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
      );

      res.json({
        success: true,
        data: entries,
        meta: { total, page: pageNum, limit: limitNum },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/audit-log/actions - distinct action types
router.get(
  '/actions',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(`SELECT DISTINCT action FROM audit_log ORDER BY action`);
      res.json({ success: true, data: result.map((r: Record<string, unknown>) => r.action) });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/audit-log/entity-types - distinct entity types
router.get(
  '/entity-types',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT DISTINCT entity_type FROM audit_log ORDER BY entity_type`
      );
      res.json({
        success: true,
        data: result.map((r: Record<string, unknown>) => r.entity_type),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
