import { createFileRoute } from '@tanstack/react-router';
import { Expenses } from '@/features/purchasing';
import { listSearchSchema } from '@/shared/lib/listSearch';
import { z } from 'zod';

export const expensesSearchSchema = listSearchSchema.extend({
  tab: z.enum(['list', 'pnl']).catch('list'),
});

export const Route = createFileRoute('/_authenticated/_admin/expenses')({
  validateSearch: expensesSearchSchema,
  component: Expenses,
});
