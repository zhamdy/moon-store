import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';

const router: Router = Router();

// --- Zod schemas ---

const openRegisterSchema = z.object({
  opening_float: z.number().min(0, 'Opening float must be non-negative'),
});

const movementSchema = z.object({
  type: z.enum(['cash_in', 'cash_out']),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().max(500).optional(),
});

const closeRegisterSchema = z.object({
  counted_cash: z.number().min(0, 'Counted cash must be non-negative'),
  notes: z.string().max(500).optional(),
});

// GET /api/register/current — Get current open session for logged-in user
router.get(
  '/current',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;

      const result = await db.query(
        `SELECT rs.*, u.name as cashier_name,
                (SELECT COUNT(*) FROM register_movements WHERE session_id = rs.id AND type = 'sale') as sale_count,
                (SELECT COALESCE(SUM(CASE WHEN type = 'sale' THEN amount WHEN type = 'cash_in' THEN amount ELSE 0 END), 0)
                 FROM register_movements WHERE session_id = rs.id) as total_in,
                (SELECT COALESCE(SUM(CASE WHEN type = 'refund' THEN amount WHEN type = 'cash_out' THEN amount ELSE 0 END), 0)
                 FROM register_movements WHERE session_id = rs.id) as total_out
         FROM register_sessions rs
         JOIN users u ON rs.cashier_id = u.id
         WHERE rs.cashier_id = ? AND rs.status = 'open'
         ORDER BY rs.opened_at DESC LIMIT 1`,
        [userId]
      );

      res.json({ success: true, data: result.rows[0] || null });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/register/open — Open a new register session
router.post(
  '/open',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = openRegisterSchema.parse(req.body);

      // Check if already has an open session
      const existing = await db.query(
        `SELECT id FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
        [userId]
      );
      if (existing.rows.length > 0) {
        return res
          .status(400)
          .json({ success: false, error: 'You already have an open register session' });
      }

      const result = await db.query(
        `INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES (?, ?, ?) RETURNING *`,
        [userId, parsed.opening_float, parsed.opening_float]
      );

      logAuditFromReq(req, 'register_open', 'register_session', result.rows[0].id as number, {
        opening_float: parsed.opening_float,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// POST /api/register/movement — Record a cash in/out movement
router.post(
  '/movement',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = movementSchema.parse(req.body);

      // Get current open session
      const session = await db.query(
        `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
        [userId]
      );
      if (session.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No open register session' });
      }

      const sessionId = session.rows[0].id as number;
      const currentExpected = session.rows[0].expected_cash as number;

      // Insert movement
      const movement = await db.query(
        `INSERT INTO register_movements (session_id, type, amount, note) VALUES (?, ?, ?, ?) RETURNING *`,
        [sessionId, parsed.type, parsed.amount, parsed.note || null]
      );

      // Update expected cash
      const delta = parsed.type === 'cash_in' ? parsed.amount : -parsed.amount;
      await db.query(`UPDATE register_sessions SET expected_cash = ? WHERE id = ?`, [
        currentExpected + delta,
        sessionId,
      ]);

      res.json({ success: true, data: movement.rows[0] });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// POST /api/register/close — Close the current register session
router.post(
  '/close',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.id;
      const parsed = closeRegisterSchema.parse(req.body);

      // Get current open session
      const session = await db.query(
        `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
        [userId]
      );
      if (session.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'No open register session' });
      }

      const sessionId = session.rows[0].id as number;
      const expectedCash = session.rows[0].expected_cash as number;
      const variance = parsed.counted_cash - expectedCash;

      const result = await db.query(
        `UPDATE register_sessions
         SET status = 'closed', closed_at = datetime('now'), counted_cash = ?, variance = ?, notes = ?
         WHERE id = ?
         RETURNING *`,
        [parsed.counted_cash, variance, parsed.notes || null, sessionId]
      );

      logAuditFromReq(req, 'register_close', 'register_session', sessionId, {
        expected_cash: expectedCash,
        counted_cash: parsed.counted_cash,
        variance,
      });

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// GET /api/register/:id/report — Get X or Z report for a session
router.get(
  '/:id/report',
  verifyToken,
  requireRole('Admin', 'Cashier'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const session = await db.query(
        `SELECT rs.*, u.name as cashier_name
         FROM register_sessions rs
         JOIN users u ON rs.cashier_id = u.id
         WHERE rs.id = ?`,
        [id]
      );
      if (session.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }

      const movements = await db.query(
        `SELECT * FROM register_movements WHERE session_id = ? ORDER BY created_at ASC`,
        [id]
      );

      // Aggregate by type
      const summary = {
        total_sales: 0,
        total_refunds: 0,
        total_cash_in: 0,
        total_cash_out: 0,
        sale_count: 0,
        refund_count: 0,
      };

      for (const m of movements.rows as { type: string; amount: number }[]) {
        switch (m.type) {
          case 'sale':
            summary.total_sales += m.amount;
            summary.sale_count++;
            break;
          case 'refund':
            summary.total_refunds += m.amount;
            summary.refund_count++;
            break;
          case 'cash_in':
            summary.total_cash_in += m.amount;
            break;
          case 'cash_out':
            summary.total_cash_out += m.amount;
            break;
        }
      }

      res.json({
        success: true,
        data: {
          session: session.rows[0],
          movements: movements.rows,
          summary,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/register/history — List past register sessions
router.get(
  '/history',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '25', cashier_id, from, to } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let where = '1=1';
      const params: unknown[] = [];

      if (cashier_id) {
        where += ' AND rs.cashier_id = ?';
        params.push(cashier_id);
      }
      if (from) {
        where += ' AND rs.opened_at >= ?';
        params.push(from);
      }
      if (to) {
        where += " AND rs.opened_at <= ? || ' 23:59:59'";
        params.push(to);
      }

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM register_sessions rs WHERE ${where}`,
        params
      );

      const result = await db.query(
        `SELECT rs.*, u.name as cashier_name,
                (SELECT COUNT(*) FROM register_movements WHERE session_id = rs.id AND type = 'sale') as sale_count,
                (SELECT COALESCE(SUM(amount), 0) FROM register_movements WHERE session_id = rs.id AND type = 'sale') as total_sales
         FROM register_sessions rs
         JOIN users u ON rs.cashier_id = u.id
         WHERE ${where}
         ORDER BY rs.opened_at DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total: countResult.rows[0].total,
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/register/:id/force-close — Admin force-close an open session
router.post(
  '/:id/force-close',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const session = await db.query(
        `SELECT id, expected_cash FROM register_sessions WHERE id = ? AND status = 'open'`,
        [id]
      );
      if (session.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'No open session found' });
      }

      const result = await db.query(
        `UPDATE register_sessions
         SET status = 'closed', closed_at = datetime('now'), notes = COALESCE(notes || ' | ', '') || 'Force-closed by admin'
         WHERE id = ?
         RETURNING *`,
        [id]
      );

      logAuditFromReq(req, 'register_force_close', 'register_session', Number(id));

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

// Helper: record a sale movement (called from sales route)
export async function recordSaleMovement(
  cashierId: number,
  saleId: number,
  cashAmount: number
): Promise<void> {
  try {
    const session = await db.query(
      `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
      [cashierId]
    );
    if (session.rows.length === 0) return; // No open session, skip

    const sessionId = session.rows[0].id;

    await db.query(
      `INSERT INTO register_movements (session_id, type, amount, sale_id) VALUES (?, 'sale', ?, ?)`,
      [sessionId, cashAmount, saleId]
    );

    await db.query(`UPDATE register_sessions SET expected_cash = expected_cash + ? WHERE id = ?`, [
      cashAmount,
      sessionId,
    ]);

    // Also link the sale to the session
    await db.query(`UPDATE sales SET register_session_id = ? WHERE id = ?`, [sessionId, saleId]);
  } catch {
    // Don't fail the sale if register tracking fails
  }
}

export async function recordRefundMovement(cashierId: number, amount: number): Promise<void> {
  try {
    const session = await db.query(
      `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = ? AND status = 'open'`,
      [cashierId]
    );
    if (session.rows.length === 0) return;

    const sessionId = session.rows[0].id;

    await db.query(
      `INSERT INTO register_movements (session_id, type, amount) VALUES (?, 'refund', ?)`,
      [sessionId, amount]
    );

    await db.query(`UPDATE register_sessions SET expected_cash = expected_cash - ? WHERE id = ?`, [
      amount,
      sessionId,
    ]);
  } catch {
    // Don't fail the refund if register tracking fails
  }
}
