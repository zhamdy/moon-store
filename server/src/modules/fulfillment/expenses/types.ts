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
  page?: number;
  limit?: number;
  category?: string;
  from?: string;
  to?: string;
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
