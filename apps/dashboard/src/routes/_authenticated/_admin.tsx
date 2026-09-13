import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getDefaultRoute } from '@/shared/lib/authRedirect';
import { isPostponedPath } from '@/shared/lib/postponedFeatures';

export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: ({ context, location }) => {
    if (context.auth.user?.role !== 'Admin' || isPostponedPath(location.pathname)) {
      throw redirect({
        to: getDefaultRoute(context.auth.user),
      });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
