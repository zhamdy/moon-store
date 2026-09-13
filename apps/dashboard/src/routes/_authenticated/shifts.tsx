import { createFileRoute, redirect } from '@tanstack/react-router';
import { Shifts } from '@/features/pos';
import { getDefaultRoute } from '@/shared/lib/authRedirect';

const ALLOWED_ROLES = ['Admin', 'Cashier', 'Delivery'];

export const Route = createFileRoute('/_authenticated/shifts')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.role || !ALLOWED_ROLES.includes(context.auth.user.role)) {
      throw redirect({ to: getDefaultRoute(context.auth.user) });
    }
  },
  component: Shifts,
});
