import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../middleware/auth';
import { logAuditFromReq } from '../../../middleware/auditLogger';
import { expensesService } from './service';

const expenseSchema = z.object({
  category: z.enum(['rent', 'salaries', 'utilities', 'marketing', 'supplies', 'other']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(500).optional(),
  date: z.string().optional(),
  recurring: z.enum(['one_time', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
});

export class ExpensesController {
  async getExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '25', category, from, to } = req.query;
      const result = await expensesService.list({
        page: Number(page),
        limit: Number(limit),
        category: category as string | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
      });

      res.json({
        success: true,
        data: result.rows,
        meta: {
          total: result.total,
          page: Number(page),
          limit: Number(limit),
          total_amount: result.total_amount,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const parsed = expenseSchema.parse(req.body);

      const record = await expensesService.create(parsed, authReq.user!.id);
      logAuditFromReq(req, 'create', 'expense', record.id as number, {
        amount: parsed.amount,
        category: parsed.category,
      });

      res.status(201).json({ success: true, data: record });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = expenseSchema.parse(req.body);
      const id = req.params.id as string;

      const record = await expensesService.update(id, parsed);
      if (!record) {
        res.status(404).json({ success: false, error: 'Expense not found' });
        return;
      }

      res.json({ success: true, data: record });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      next(err);
    }
  }

  async deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const deleted = await expensesService.delete(id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Expense not found' });
        return;
      }

      logAuditFromReq(req, 'delete', 'expense', Number(id));
      res.json({ success: true, data: { message: 'Expense deleted' } });
    } catch (err) {
      next(err);
    }
  }

  async getPnL(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const dateFrom =
        (from as string) ||
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const dateTo = (to as string) || new Date().toISOString().split('T')[0];

      const pnl = await expensesService.getPnL(dateFrom, dateTo);
      res.json({ success: true, data: pnl });
    } catch (err) {
      next(err);
    }
  }
}

export const expensesController = new ExpensesController();
