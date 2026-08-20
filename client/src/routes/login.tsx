import { createFileRoute, redirect } from '@tanstack/react-router';
import { Login } from '@/features/auth';
import { getDefaultRoute } from '@/shared/lib/authRedirect';

interface LoginSearchParams {
  redirect?: string;
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearchParams => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({
        to: search.redirect || getDefaultRoute(context.auth.user),
      });
    }
  },
  component: Login,
});
