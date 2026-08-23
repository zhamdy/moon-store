import { createFileRoute, redirect } from '@tanstack/react-router';
import { Inventory } from '@/features/inventory';
import { getDefaultRoute } from '@/shared/lib/authRedirect';
import { z } from 'zod';

const ALLOWED_ROLES = ['Admin', 'Cashier'];

const optionalPositiveInt = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : Number(value)),
  z.number().int().positive().optional()
);

const inventorySearchSchema = z.object({
  page: z.preprocess((value) => Number(value ?? 1), z.number().int().positive().catch(1)),
  pageSize: z.preprocess(
    (value) => Number(value ?? 25),
    z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).catch(25)
  ),
  search: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().slice(0, 100) || undefined : undefined),
    z.string().optional()
  ),
  sortBy: z.enum(['name', 'price', 'stock', 'category', 'createdAt']).catch('name'),
  sortOrder: z.enum(['asc', 'desc']).catch('asc'),
  categoryId: optionalPositiveInt.catch(undefined),
  status: z.enum(['all', 'active', 'inactive', 'discontinued']).catch('all'),
  lowStock: z.preprocess((value) => value === true || value === 'true', z.boolean()).catch(false),
});

export const Route = createFileRoute('/_authenticated/inventory')({
  validateSearch: inventorySearchSchema,
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.role || !ALLOWED_ROLES.includes(context.auth.user.role)) {
      throw redirect({ to: getDefaultRoute(context.auth.user) });
    }
  },
  component: Inventory,
});
