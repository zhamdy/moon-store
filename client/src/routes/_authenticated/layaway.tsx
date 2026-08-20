import { createFileRoute, redirect } from '@tanstack/react-router';
import { Layaway } from '@/features/sales';
import { getDefaultRoute } from '@/shared/lib/authRedirect';

const ALLOWED_ROLES = ['Admin', 'Cashier'];

export const Route = createFileRoute('/_authenticated/layaway')({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.role || !ALLOWED_ROLES.includes(context.auth.user.role)) {
      throw redirect({ to: getDefaultRoute(context.auth.user) });
    }
  },
  component: Layaway,
});
