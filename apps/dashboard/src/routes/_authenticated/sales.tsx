import { createFileRoute, redirect } from '@tanstack/react-router';
import { SalesHistory } from '@/features/sales';
import { getDefaultRoute } from '@/shared/lib/authRedirect';
import { listSearchSchema } from '@/shared/lib/listSearch';
import { z } from 'zod';

const ALLOWED_ROLES = ['Admin', 'Cashier'];

export const salesSearchSchema = listSearchSchema.extend({
  paymentMethod: z.string().trim().max(30).optional().catch(undefined),
  dateFrom: z.string().trim().max(10).optional().catch(undefined),
  dateTo: z.string().trim().max(10).optional().catch(undefined),
  sortBy: z.enum(['createdAt', 'total']).catch('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).catch('desc'),
});

export const Route = createFileRoute('/_authenticated/sales')({
  validateSearch: salesSearchSchema,
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.role || !ALLOWED_ROLES.includes(context.auth.user.role)) {
      throw redirect({ to: getDefaultRoute(context.auth.user) });
    }
  },
  component: SalesHistory,
});
