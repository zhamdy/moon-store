import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { expensesRequestContracts, expenseSchema } from './schemas';
import type { ExpenseFilters } from './types';
import { AuthRequest } from '../../../../middleware/auth';
import { logAuditFromReq } from '../../../../middleware/auditLogger';
import { expensesService } from './service';
import { success } from '../../../http/responses';
import { paginationMeta } from '../../../http/pagination';
import { PublicError } from '../../../http/errors';

/** Parsed through the contracts, so the document and the validators cannot differ (#102). */
const contracts = expensesRequestContracts;

export class ExpensesController {
  async getExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = contracts.listExpenses.parseQuery<ExpenseFilters>(req.query);
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
      const parsed = contracts.createExpense.parseBody<z.infer<typeof expenseSchema>>(req.body);

      const authReq = req as AuthRequest;
      const expense = await expensesService.create(parsed, authReq.user!.id);

      logAuditFromReq(req, 'create', 'expense', expense.id as number, {
        amount: parsed.amount,
        category: parsed.category,
      });

      res.status(201).json(success(expense));
    } catch (err) {
      next(err);
    }
  }

  async updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = contracts.updateExpense.parseBody<z.infer<typeof expenseSchema>>(req.body);

      const { id } = contracts.updateExpense.parseParams<{ id: string }>(req.params);
      const updated = await expensesService.update(id as string, parsed);
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
      const { id } = contracts.deleteExpense.parseParams<{ id: string }>(req.params);
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
