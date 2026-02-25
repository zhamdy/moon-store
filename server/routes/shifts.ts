import { Router, Request, Response, NextFunction } from 'express';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';

const router: Router = Router();

// GET /api/shifts/current — Get current active shift for user
router.get('/current', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const result = await db.query(
      `SELECT s.*, u.name as user_name
         FROM shifts s JOIN users u ON s.user_id = u.id
         WHERE s.user_id = ? AND s.status IN ('active', 'on_break')
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
      `SELECT id FROM shifts WHERE user_id = ? AND status IN ('active', 'on_break')`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Already clocked in' });
    }

    const result = await db.query(`INSERT INTO shifts (user_id) VALUES (?) RETURNING *`, [userId]);
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

    const shift = await db.query(
      `SELECT id, clock_in, break_minutes FROM shifts WHERE user_id = ? AND status IN ('active', 'on_break')`,
      [userId]
    );
    if (shift.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No active shift' });
    }

    const shiftId = shift.rows[0].id;

    // End any active break
    db.db
      .prepare(
        `UPDATE shift_breaks SET end_time = datetime('now'), duration_minutes = CAST((julianday('now') - julianday(start_time)) * 1440 AS INTEGER) WHERE shift_id = ? AND end_time IS NULL`
      )
      .run(shiftId);

    // Calculate total break minutes
    const breakResult = await db.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total_break FROM shift_breaks WHERE shift_id = ?`,
      [shiftId]
    );

    const totalBreak = breakResult.rows[0].total_break as number;
    const totalHours = `ROUND((julianday('now') - julianday(clock_in)) * 24 - ${totalBreak / 60.0}, 2)`;

    const result = await db.query(
      `UPDATE shifts SET clock_out = datetime('now'), status = 'completed', break_minutes = ?, total_hours = ${totalHours} WHERE id = ? RETURNING *`,
      [totalBreak, shiftId]
    );

    res.json({ success: true, data: result.rows[0] });
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
      const shift = await db.query(
        `SELECT id FROM shifts WHERE user_id = ? AND status = 'active'`,
        [authReq.user!.id]
      );
      if (shift.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No active shift' });
      }

      const shiftId = shift.rows[0].id;
      await db.query(`UPDATE shifts SET status = 'on_break' WHERE id = ?`, [shiftId]);
      const breakResult = await db.query(
        `INSERT INTO shift_breaks (shift_id) VALUES (?) RETURNING *`,
        [shiftId]
      );

      res.json({ success: true, data: breakResult.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/shifts/end-break
router.post('/end-break', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const shift = await db.query(
      `SELECT id FROM shifts WHERE user_id = ? AND status = 'on_break'`,
      [authReq.user!.id]
    );
    if (shift.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Not on break' });
    }

    const shiftId = shift.rows[0].id;
    db.db
      .prepare(
        `UPDATE shift_breaks SET end_time = datetime('now'), duration_minutes = CAST((julianday('now') - julianday(start_time)) * 1440 AS INTEGER) WHERE shift_id = ? AND end_time IS NULL`
      )
      .run(shiftId);

    await db.query(`UPDATE shifts SET status = 'active' WHERE id = ?`, [shiftId]);
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
  async (req: Request, res: Response, next: NextFunction) => {
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
        where += ' AND s.user_id = ?';
        params.push(user_id);
      }
      if (from) {
        where += ' AND s.clock_in >= ?';
        params.push(from);
      }
      if (to) {
        where += " AND s.clock_in <= ? || ' 23:59:59'";
        params.push(to);
      }

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM shifts s WHERE ${where}`,
        params
      );
      const result = await db.query(
        `SELECT s.*, u.name as user_name, u.role
         FROM shifts s JOIN users u ON s.user_id = u.id
         WHERE ${where}
         ORDER BY s.clock_in DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: { total: countResult.rows[0].total, page: Number(page), limit: Number(limit) },
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
        where += ' AND s.clock_in >= ?';
        params.push(from);
      }
      if (to) {
        where += " AND s.clock_in <= ? || ' 23:59:59'";
        params.push(to);
      }

      const result = await db.query(
        `SELECT u.id, u.name, u.role,
                COUNT(s.id) as shift_count,
                COALESCE(SUM(s.total_hours), 0) as total_hours,
                COALESCE(SUM(s.break_minutes), 0) as total_break_minutes
         FROM users u
         LEFT JOIN shifts s ON s.user_id = u.id AND ${where}
         GROUP BY u.id
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
