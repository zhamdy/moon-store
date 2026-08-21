import { Router, Request, Response, NextFunction } from 'express';
import db from '../../database/pool';
import { verifyToken, requireRole } from '../../../middleware/auth';

const router: Router = Router();

// GET /api/audit-log — Query audit log with filters and pagination
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        userId,
        action,
        entityType,
        entityId,
        startDate,
        endDate,
        page = '1',
        limit = '50',
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);
      const where: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      if (userId) {
        where.push(`user_id = $${paramIdx++}`);
        params.push(Number(userId));
      }
      if (action) {
        where.push(`action = $${paramIdx++}`);
        params.push(String(action));
      }
      if (entityType) {
        where.push(`entity_type = $${paramIdx++}`);
        params.push(String(entityType));
      }
      if (entityId) {
        where.push(`entity_id = $${paramIdx++}`);
        params.push(String(entityId));
      }
      if (startDate) {
        where.push(`created_at >= $${paramIdx++}`);
        params.push(String(startDate));
      }
      if (endDate) {
        where.push(`created_at <= $${paramIdx++}`);
        params.push(String(endDate));
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const countResult = await db.query<{ count: string | number }>(
        `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.count || 0);

      const queryParams = [...params, Number(limit), offset];
      const limitIdx = paramIdx++;
      const offsetIdx = paramIdx++;

      const result = await db.query(
        `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        queryParams
      );

      const logs = result.rows.map((row: any) => ({
        ...row,
        details:
          row.details && typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      }));

      res.json({
        success: true,
        data: logs,
        meta: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/audit-log/actions — Get distinct action types for filter dropdown
router.get(
  '/actions',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query<{ action: string }>(
        'SELECT DISTINCT action FROM audit_logs ORDER BY action'
      );
      res.json({ success: true, data: result.rows.map((r) => r.action) });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
