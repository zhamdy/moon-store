export type ExpenseCategory =
  | 'rent'
  | 'salaries'
  | 'utilities'
  | 'marketing'
  | 'supplies'
  | 'other';

export type ExpenseRecurring = 'one_time' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ExpenseRecord {
  id: number;
  category: ExpenseCategory;
  amount: number;
  description?: string | null;
  date: string;
  recurring: ExpenseRecurring;
  user_id: number;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

export interface CreateExpenseDTO {
  category: ExpenseCategory;
  amount: number;
  description?: string | null;
  date?: string;
  recurring?: ExpenseRecurring;
}

export type UpdateExpenseDTO = CreateExpenseDTO;

export interface ExpenseFilters {
  page: number;
  pageSize: number;
  category?: string;
  from?: string;
  to?: string;
  sortBy: 'date' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

const expenseListQuerySchema = createListQuerySchema(['date', 'createdAt'] as const)
  .extend({
    category: z
      .enum(['rent', 'salaries', 'utilities', 'marketing', 'supplies', 'other'])
      .optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'date', ...query }));

export function parseExpenseListQuery(query: unknown): ExpenseFilters {
  const parsed = expenseListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    category: parsed.category,
    from: parsed.from,
    to: parsed.to,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export interface ExpenseListResult {
  rows: Record<string, any>[];
  total: number;
  total_amount: number;
}

export interface PnlResult {
  period: { from: string; to: string };
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  expenses_by_category: Record<string, any>[];
  net_profit: number;
}
