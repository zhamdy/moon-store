import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
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
      const parsed = expenseSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const authReq = req as AuthRequest;
      const expense = await expensesService.create(parsed.data, authReq.user!.id);

      logAuditFromReq(req, 'create', 'expense', expense.id as number, {
        amount: parsed.data.amount,
        category: parsed.data.category,
      });

      res.status(201).json({ success: true, data: expense });
    } catch (err) {
      next(err);
    }
  }

  async updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = expenseSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors[0].message });
        return;
      }

      const { id } = req.params;
      const updated = await expensesService.update(id as string, parsed.data);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Expense not found' });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await expensesService.delete(id as string);
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

  async getPnl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await expensesService.getPnl(from as string | undefined, to as string | undefined);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const expensesController = new ExpensesController();
