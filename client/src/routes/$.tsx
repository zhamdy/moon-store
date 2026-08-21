import { createFileRoute, redirect } from '@tanstack/react-router';
import { getDefaultRoute } from '@/shared/lib/authRedirect';

export const Route = createFileRoute('/$')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        replace: true,
      });
    }
    throw redirect({
      to: getDefaultRoute(context.auth.user),
      replace: true,
    });
  },
});
