import { createFileRoute, redirect } from '@tanstack/react-router';
import { Login } from '@/features/auth';
import { getDefaultRoute, safeRedirectTarget } from '@/shared/lib/authRedirect';

interface LoginSearchParams {
  redirect?: string;
}

export const Route = createFileRoute('/login')({
  // Filtered here rather than where it is read: this is the one door the
  // param comes in through, and an open redirect is only open if it survives
  // parsing. See safeRedirectTarget for what is rejected.
  validateSearch: (search: Record<string, unknown>): LoginSearchParams => ({
    redirect: safeRedirectTarget(search.redirect),
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
