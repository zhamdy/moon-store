import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../db';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { logAuditFromReq } from '../middleware/auditLogger';

const router: Router = Router();

const expenseSchema = z.object({
  category: z.enum(['rent', 'salaries', 'utilities', 'marketing', 'supplies', 'other']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(500).optional(),
  date: z.string().optional(),
  recurring: z.enum(['one_time', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
});

// GET /api/expenses — List expenses
router.get(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '25', category, from, to } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let where = '1=1';
      const params: unknown[] = [];

      if (category) {
        where += ' AND category = ?';
        params.push(category);
      }
      if (from) {
        where += ' AND date >= ?';
        params.push(from);
      }
      if (to) {
        where += ' AND date <= ?';
        params.push(to);
      }

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM expenses WHERE ${where}`,
        params
      );
      const sumResult = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total_amount FROM expenses WHERE ${where}`,
        params
      );

      const result = await db.query(
        `SELECT e.*, u.name as user_name
         FROM expenses e LEFT JOIN users u ON e.user_id = u.id
         WHERE ${where}
         ORDER BY e.date DESC, e.created_at DESC
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
          total_amount: sumResult.rows[0].total_amount,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/expenses — Create expense
router.post(
  '/',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const parsed = expenseSchema.parse(req.body);

      const result = await db.query(
        `INSERT INTO expenses (category, amount, description, date, recurring, user_id) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        [
          parsed.category,
          parsed.amount,
          parsed.description || null,
          parsed.date || new Date().toISOString().split('T')[0],
          parsed.recurring || 'one_time',
          authReq.user!.id,
        ]
      );

      logAuditFromReq(req, 'create', 'expense', result.rows[0].id as number, {
        amount: parsed.amount,
        category: parsed.category,
      });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// PUT /api/expenses/:id — Update expense
router.put(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = expenseSchema.parse(req.body);
      const { id } = req.params;

      const existing = await db.query('SELECT id FROM expenses WHERE id = ?', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }

      const result = await db.query(
        `UPDATE expenses SET category = ?, amount = ?, description = ?, date = ?, recurring = ?, updated_at = datetime('now') WHERE id = ? RETURNING *`,
        [
          parsed.category,
          parsed.amount,
          parsed.description || null,
          parsed.date || new Date().toISOString().split('T')[0],
          parsed.recurring || 'one_time',
          id,
        ]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: err.errors[0].message });
      }
      next(err);
    }
  }
);

// DELETE /api/expenses/:id — Delete expense
router.delete(
  '/:id',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await db.query('SELECT id FROM expenses WHERE id = ?', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }

      await db.query('DELETE FROM expenses WHERE id = ?', [id]);
      logAuditFromReq(req, 'delete', 'expense', Number(id));
      res.json({ success: true, data: { message: 'Expense deleted' } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/expenses/pnl — Profit & Loss statement
router.get(
  '/pnl',
  verifyToken,
  requireRole('Admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to } = req.query;
      const dateFrom =
        (from as string) ||
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const dateTo = (to as string) || new Date().toISOString().split('T')[0];

      // Revenue
      const revenueResult = await db.query(
        `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue
         FROM sales WHERE date(created_at) >= ? AND date(created_at) <= ?`,
        [dateFrom, dateTo]
      );

      // COGS
      const cogsResult = await db.query(
        `SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) as cogs
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE date(s.created_at) >= ? AND date(s.created_at) <= ?`,
        [dateFrom, dateTo]
      );

      // Expenses by category
      const expensesResult = await db.query(
        `SELECT category, COALESCE(SUM(amount), 0) as total
         FROM expenses WHERE date >= ? AND date <= ?
         GROUP BY category`,
        [dateFrom, dateTo]
      );

      const totalExpensesResult = await db.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ?`,
        [dateFrom, dateTo]
      );

      const revenue = revenueResult.rows[0].revenue as number;
      const cogs = cogsResult.rows[0].cogs as number;
      const grossProfit = revenue - cogs;
      const operatingExpenses = totalExpensesResult.rows[0].total as number;
      const netProfit = grossProfit - operatingExpenses;

      res.json({
        success: true,
        data: {
          period: { from: dateFrom, to: dateTo },
          revenue,
          cogs,
          gross_profit: grossProfit,
          operating_expenses: operatingExpenses,
          expenses_by_category: expensesResult.rows,
          net_profit: netProfit,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
