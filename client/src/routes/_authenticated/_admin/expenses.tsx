import { createFileRoute } from '@tanstack/react-router';
import { Expenses } from '@/features/purchasing';

export const Route = createFileRoute('/_authenticated/_admin/expenses')({
  component: Expenses,
});
