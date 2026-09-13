import { createFileRoute, redirect } from '@tanstack/react-router';
import { Deliveries } from '@/features/fulfillment';
import { getDefaultRoute } from '@/shared/lib/authRedirect';
import { listSearchSchema } from '@/shared/lib/listSearch';
import { z } from 'zod';

const ALLOWED_ROLES = ['Admin', 'Delivery'];

export const deliverySearchSchema = listSearchSchema.extend({
  status: z.enum(['Pending', 'Shipped', 'Delivered', 'Cancelled']).optional().catch(undefined),
});

export const Route = createFileRoute('/_authenticated/deliveries')({
  validateSearch: deliverySearchSchema,
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.role || !ALLOWED_ROLES.includes(context.auth.user.role)) {
      throw redirect({ to: getDefaultRoute(context.auth.user) });
    }
  },
  component: Deliveries,
});
