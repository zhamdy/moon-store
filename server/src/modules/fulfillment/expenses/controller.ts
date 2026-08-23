import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { expensesService } from './service';
import { parseExpenseListQuery } from './types';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

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
      const query = parseExpenseListQuery(req.query);
      const result = await expensesService.list(query);
      res.json(
        success(result.rows, {
          pagination: paginationMeta(query.page, query.pageSize, result.total),
          totalAmount: result.total_amount,
        })
      );
    } catch (err) {
      next(err);
    }
  }

  async createExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = expenseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const authReq = req as AuthRequest;
      const expense = await expensesService.create(parsed.data, authReq.user!.id);

      logAuditFromReq(req, 'create', 'expense', expense.id as number, {
        amount: parsed.data.amount,
        category: parsed.data.category,
      });

      res.status(201).json(success(expense));
    } catch (err) {
      next(err);
    }
  }

  async updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = expenseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const { id } = req.params;
      const updated = await expensesService.update(id as string, parsed.data);
      if (!updated) {
        throw new PublicError('NOT_FOUND', 'Expense not found');
      }

      res.json(success(updated));
    } catch (err) {
      next(err);
    }
  }

  async deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await expensesService.delete(id as string);
      if (!deleted) {
        throw new PublicError('NOT_FOUND', 'Expense not found');
      }

      logAuditFromReq(req, 'delete', 'expense', Number(id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async getPnl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query;
      const data = await expensesService.getPnl(
        from as string | undefined,
        to as string | undefined
      );
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  }
}

export const expensesController = new ExpensesController();
