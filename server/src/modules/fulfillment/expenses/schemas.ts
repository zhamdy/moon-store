/**
 * The expenses module's request contracts (#102).
 */
import { z } from 'zod';
import { defineRequestContract, pathIdParams } from '../../../http/requestContracts';
import { expenseListQuerySchema } from './types';

export const expenseSchema = z.object({
  category: z.enum(['rent', 'salaries', 'utilities', 'marketing', 'supplies', 'other']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(500).optional(),
  date: z.string().optional(),
  recurring: z.enum(['one_time', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
});

export const expensesRequestContracts = {
  listExpenses: defineRequestContract({
    method: 'GET',
    path: '/api/v1/expenses',
    operation: 'listExpenses',
    query: expenseListQuerySchema,
    beyondSchema: ['The query is strict: a parameter not listed is rejected, not ignored.'],
  }),

  createExpense: defineRequestContract({
    method: 'POST',
    path: '/api/v1/expenses',
    operation: 'createExpense',
    body: expenseSchema,
  }),

  getProfitAndLoss: defineRequestContract({
    method: 'GET',
    path: '/api/v1/expenses/pnl',
    operation: 'getProfitAndLoss',
    beyondSchema: [
      'Revenue comes from sales and costs from expenses, so the figure moves when either ' +
        'side is edited retroactively.',
    ],
  }),

  updateExpense: defineRequestContract({
    method: 'PUT',
    path: '/api/v1/expenses/{id}',
    operation: 'updateExpense',
    body: expenseSchema,
    params: pathIdParams(),
    beyondSchema: ['A full replacement, not a merge.'],
  }),

  deleteExpense: defineRequestContract({
    method: 'DELETE',
    path: '/api/v1/expenses/{id}',
    operation: 'deleteExpense',
    params: pathIdParams(),
  }),
} as const;

export const expensesContractList = Object.values(expensesRequestContracts);
