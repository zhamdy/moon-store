import { createFileRoute, redirect } from '@tanstack/react-router';
import { Deliveries } from '@/features/fulfillment';
import { getDefaultRoute } from '@/shared/lib/authRedirect';

const ALLOWED_ROLES = ['Admin', 'Delivery'];

export const Route = createFileRoute('/_authenticated/deliveries')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.role || !ALLOWED_ROLES.includes(context.auth.user.role)) {
      throw redirect({ to: getDefaultRoute(context.auth.user) });
    }
  },
  component: Deliveries,
});
