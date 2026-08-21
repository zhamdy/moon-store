import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import db from '../src/database/pool';
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
        params.push(category);
        where += ` AND category = $${params.length}`;
      }
      if (from) {
        params.push(from);
        where += ` AND date >= $${params.length}`;
      }
      if (to) {
        params.push(to);
        where += ` AND date <= $${params.length}`;
      }

      const countResult = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int as total FROM expenses WHERE ${where}`,
        params
      );
      const sumResult = await db.query<{ total_amount: string | number }>(
        `SELECT COALESCE(SUM(amount), 0) as total_amount FROM expenses WHERE ${where}`,
        params
      );

      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;
      const result = await db.query(
        `SELECT e.*, u.name as user_name
         FROM expenses e LEFT JOIN users u ON e.user_id = u.id
         WHERE ${where}
         ORDER BY e.date DESC, e.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, Number(limit), offset]
      );

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total: Number(countResult.rows[0]?.total || 0),
          page: Number(page),
          limit: Number(limit),
          total_amount: Number(sumResult.rows[0]?.total_amount || 0),
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
        `INSERT INTO expenses (category, amount, description, date, recurring, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
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

      const existing = await db.query('SELECT id FROM expenses WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }

      const result = await db.query(
        `UPDATE expenses SET category = $1, amount = $2, description = $3, date = $4, recurring = $5, updated_at = NOW() WHERE id = $6 RETURNING *`,
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
      const existing = await db.query('SELECT id FROM expenses WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Expense not found' });
      }

      await db.query('DELETE FROM expenses WHERE id = $1', [id]);
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
      const revenueResult = await db.query<{ revenue: string | number }>(
        `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue
         FROM sales WHERE created_at::date >= $1 AND created_at::date <= $2`,
        [dateFrom, dateTo]
      );

      // COGS
      const cogsResult = await db.query<{ cogs: string | number }>(
        `SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) as cogs
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         WHERE s.created_at::date >= $1 AND s.created_at::date <= $2`,
        [dateFrom, dateTo]
      );

      // Expenses by category
      const expensesResult = await db.query(
        `SELECT category, COALESCE(SUM(amount), 0) as total
         FROM expenses WHERE date >= $1 AND date <= $2
         GROUP BY category`,
        [dateFrom, dateTo]
      );

      const totalExpensesResult = await db.query<{ total: string | number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= $1 AND date <= $2`,
        [dateFrom, dateTo]
      );

      const revenue = Number(revenueResult.rows[0]?.revenue || 0);
      const cogs = Number(cogsResult.rows[0]?.cogs || 0);
      const grossProfit = revenue - cogs;
      const operatingExpenses = Number(totalExpensesResult.rows[0]?.total || 0);
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
