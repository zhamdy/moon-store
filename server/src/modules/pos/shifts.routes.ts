import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../../database/pool';
import { verifyToken, AuthRequest } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';

const router: Router = Router();

const clockInSchema = z.object({
  branch_id: z.number().int().positive().optional(),
  notes: z.string().max(255).optional(),
});

const clockOutSchema = z.object({
  notes: z.string().max(255).optional(),
});

// GET /api/shifts/current
router.get('/current', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const result = await db.query(
      `SELECT s.*, b.name as branch_name
         FROM shifts s LEFT JOIN branches b ON s.branch_id = b.id
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
    const parsed = clockInSchema.parse(req.body);

    // Check if already clocked in
    const active = await db.query(
      `SELECT id FROM shifts WHERE user_id = $1 AND status IN ('active', 'on_break')`,
      [authReq.user!.id]
    );
    if (active.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Already clocked in' });
    }

    const result = await db.query(
      `INSERT INTO shifts (user_id, branch_id, clock_in, status, notes)
         VALUES ($1, $2, NOW(), 'active', $3) RETURNING *`,
      [authReq.user!.id, parsed.branch_id || null, parsed.notes || null]
    );

    logAuditFromReq(req, 'clock_in', 'shift', result.rows[0].id as number);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// POST /api/shifts/clock-out
router.post('/clock-out', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = clockOutSchema.parse(req.body);

    const active = await db.query(
      `SELECT * FROM shifts WHERE user_id = $1 AND status IN ('active', 'on_break') ORDER BY clock_in DESC LIMIT 1`,
      [authReq.user!.id]
    );
    if (active.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No active shift found' });
    }

    const shift = active.rows[0];

    // End active break if any
    if (shift.status === 'on_break' && shift.break_start) {
      await db.query(
        `UPDATE shifts SET
            break_minutes = COALESCE(break_minutes, 0) + GREATEST(0, EXTRACT(EPOCH FROM (NOW() - break_start::timestamp)) / 60)::int,
            break_start = NULL
           WHERE id = $1`,
        [shift.id]
      );
    }

    const result = await db.query(
      `UPDATE shifts SET
          clock_out = NOW(),
          total_hours = ROUND((GREATEST(0, EXTRACT(EPOCH FROM (NOW() - clock_in::timestamp)) / 3600.0) - COALESCE(break_minutes, 0) / 60.0)::numeric, 2),
          status = 'completed',
          notes = COALESCE($1, notes)
         WHERE id = $2 RETURNING *`,
      [parsed.notes || null, shift.id]
    );

    logAuditFromReq(req, 'clock_out', 'shift', shift.id as number);
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    next(err);
  }
});

// POST /api/shifts/break/start
router.post(
  '/break/start',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const active = await db.query(
        `SELECT * FROM shifts WHERE user_id = $1 AND status = 'active' ORDER BY clock_in DESC LIMIT 1`,
        [authReq.user!.id]
      );
      if (active.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No active shift to start break' });
      }

      const result = await db.query(
        `UPDATE shifts SET status = 'on_break', break_start = NOW() WHERE id = $1 RETURNING *`,
        [active.rows[0].id]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/shifts/break/end
router.post('/break/end', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const onBreak = await db.query(
      `SELECT * FROM shifts WHERE user_id = $1 AND status = 'on_break' ORDER BY clock_in DESC LIMIT 1`,
      [authReq.user!.id]
    );
    if (onBreak.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Not currently on break' });
    }

    const shift = onBreak.rows[0];

    const result = await db.query(
      `UPDATE shifts SET
          status = 'active',
          break_minutes = COALESCE(break_minutes, 0) + GREATEST(0, EXTRACT(EPOCH FROM (NOW() - break_start::timestamp)) / 60)::int,
          break_start = NULL
         WHERE id = $1 RETURNING *`,
      [shift.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/shifts — List shifts (Admin or user's own)
router.get('/', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthRequest;
    const { user_id, from, to, page = '1', limit = '20' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const targetUser = authReq.user!.role === 'Admin' ? user_id : authReq.user!.id;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (targetUser) {
      params.push(Number(targetUser));
      where += ` AND s.user_id = $${params.length}`;
    }
    if (from) {
      params.push(from);
      where += ` AND s.clock_in >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where += ` AND s.clock_in <= $${params.length}`;
    }

    const countResult = await db.query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM shifts s ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const shifts = await db.query(
      `SELECT s.*, u.name as user_name, u.email as user_email, b.name as branch_name
         FROM shifts s
         JOIN users u ON s.user_id = u.id
         LEFT JOIN branches b ON s.branch_id = b.id
         ${where}
         ORDER BY s.clock_in DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: shifts.rows,
      meta: {
        total: Number(countResult.rows[0]?.total || 0),
        page: Number(page),
        limit: Number(limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
