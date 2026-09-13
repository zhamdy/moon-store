import { createFileRoute } from '@tanstack/react-router';
import { Users } from '@/features/admin';
import { listSearchSchema } from '@/shared/lib/listSearch';
import { z } from 'zod';

export const userSearchSchema = listSearchSchema.extend({
  search: z.string().trim().max(100).optional().catch(undefined),
  sortBy: z.enum(['name', 'email', 'role', 'createdAt', 'lastLogin']).catch('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).catch('desc'),
});

export const Route = createFileRoute('/_authenticated/_admin/users')({
  validateSearch: userSearchSchema,
  component: Users,
});
