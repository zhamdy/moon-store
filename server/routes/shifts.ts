import { Router, Request, Response, NextFunction } from 'express';
import db from '../src/database/pool';
import { withTransaction } from '../src/database/transaction';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';

const router: Router = Router();

// GET /api/shifts/current — Get current active shift for user
router.get('/current', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const result = await db.query(
      `SELECT s.*, u.name as user_name
         FROM shifts s JOIN users u ON s.user_id = u.id
         WHERE s.user_id = $1 AND s.status IN ('active', 'on_break')
         ORDER BY s.clock_in DESC LIMIT 1`,
      [authReq.user!.id]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/clock-in
router.post('/clock-in', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    // Check if already clocked in
    const existing = await db.query(
      `SELECT id FROM shifts WHERE user_id = $1 AND status IN ('active', 'on_break')`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Already clocked in' });
    }

    const result = await db.query(`INSERT INTO shifts (user_id) VALUES ($1) RETURNING *`, [userId]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/clock-out
router.post('/clock-out', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    const result = await withTransaction(async (client) => {
      const shiftRes = await client.query(
        `SELECT id, clock_in, break_minutes FROM shifts WHERE user_id = $1 AND status IN ('active', 'on_break') FOR UPDATE`,
        [userId]
      );
      if (shiftRes.rows.length === 0) {
        return null;
      }

      const shiftId = shiftRes.rows[0].id;

      // End any active break
      await client.query(
        `UPDATE shift_breaks SET end_time = NOW(), duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - start_time)) / 60)::int WHERE shift_id = $1 AND end_time IS NULL`,
        [shiftId]
      );

      // Calculate total break minutes
      const breakResult = await client.query<{ total_break: string | number }>(
        `SELECT COALESCE(SUM(duration_minutes), 0) as total_break FROM shift_breaks WHERE shift_id = $1`,
        [shiftId]
      );

      const totalBreak = Number(breakResult.rows[0].total_break);
      const breakHours = totalBreak / 60.0;

      const updateRes = await client.query(
        `UPDATE shifts SET clock_out = NOW(), status = 'completed', break_minutes = $1, total_hours = ROUND((EXTRACT(EPOCH FROM (NOW() - clock_in)) / 3600.0 - $2)::numeric, 2) WHERE id = $3 RETURNING *`,
        [totalBreak, breakHours, shiftId]
      );

      return updateRes.rows[0];
    });

    if (!result) {
      return res.status(400).json({ success: false, error: 'No active shift' });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/shifts/start-break
router.post(
  '/start-break',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const result = await withTransaction(async (client) => {
        const shiftRes = await client.query(
          `SELECT id FROM shifts WHERE user_id = $1 AND status = 'active' FOR UPDATE`,
          [authReq.user!.id]
        );
        if (shiftRes.rows.length === 0) {
          return null;
        }

        const shiftId = shiftRes.rows[0].id;
        await client.query(`UPDATE shifts SET status = 'on_break' WHERE id = $1`, [shiftId]);
        const breakResult = await client.query(
          `INSERT INTO shift_breaks (shift_id) VALUES ($1) RETURNING *`,
          [shiftId]
        );
        return breakResult.rows[0];
      });

      if (!result) {
        return res.status(400).json({ success: false, error: 'No active shift' });
      }

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/shifts/end-break
router.post('/end-break', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const result = await withTransaction(async (client) => {
      const shiftRes = await client.query(
        `SELECT id FROM shifts WHERE user_id = $1 AND status = 'on_break' FOR UPDATE`,
        [authReq.user!.id]
      );
      if (shiftRes.rows.length === 0) {
        return false;
      }

      const shiftId = shiftRes.rows[0].id;
      await client.query(
        `UPDATE shift_breaks SET end_time = NOW(), duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - start_time)) / 60)::int WHERE shift_id = $1 AND end_time IS NULL`,
        [shiftId]
      );

      await client.query(`UPDATE shifts SET status = 'active' WHERE id = $1`, [shiftId]);
      return true;
    });

    if (!result) {
      return res.status(400).json({ success: false, error: 'Not on break' });
    }

    res.json({ success: true, data: { message: 'Break ended' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/shifts/active — List all currently active shifts (Admin)
router.get(
  '/active',
  verifyToken,
  requireRole('Admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await db.query(
        `SELECT s.*, u.name as user_name, u.role
         FROM shifts s JOIN users u ON s.user_id = u.id
         WHERE s.status IN ('active', 'on_break')
         ORDER BY s.clock_in ASC`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/shifts/history — Shift history with filters
router.get(
  '/history',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '25', user_id, from, to } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let where = "s.status = 'completed'";
      const params: unknown[] = [];

      if (user_id) {
        params.push(user_id);
        where += ` AND s.user_id = $${params.length}`;
      }
      if (from) {
        params.push(from);
        where += ` AND s.clock_in >= $${params.length}::timestamptz`;
      }
      if (to) {
        params.push(`${to} 23:59:59`);
        where += ` AND s.clock_in <= $${params.length}::timestamptz`;
      }

      const countResult = await db.query<{ total: string | number }>(
        `SELECT COUNT(*)::int as total FROM shifts s WHERE ${where}`,
        params
      );
      const total = Number(countResult.rows[0].total);

      const limitNum = Number(limit);
      const offsetNum = offset;
      const queryParams = [...params, limitNum, offsetNum];

      const result = await db.query(
        `SELECT s.*, u.name as user_name, u.role
         FROM shifts s JOIN users u ON s.user_id = u.id
         WHERE ${where}
         ORDER BY s.clock_in DESC
         LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
        queryParams
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/shifts/timesheet — Aggregated timesheet
router.get(
  '/timesheet',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      let where = "s.status = 'completed'";
      const params: unknown[] = [];

      if (from) {
        params.push(from);
        where += ` AND s.clock_in >= $${params.length}::timestamptz`;
      }
      if (to) {
        params.push(`${to} 23:59:59`);
        where += ` AND s.clock_in <= $${params.length}::timestamptz`;
      }

      const result = await db.query(
        `SELECT u.id, u.name, u.role,
                COUNT(s.id)::int as shift_count,
                COALESCE(SUM(s.total_hours), 0) as total_hours,
                COALESCE(SUM(s.break_minutes), 0) as total_break_minutes
         FROM users u
         LEFT JOIN shifts s ON s.user_id = u.id AND ${where}
         GROUP BY u.id, u.name, u.role
         ORDER BY total_hours DESC`,
        params
      );

      res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
