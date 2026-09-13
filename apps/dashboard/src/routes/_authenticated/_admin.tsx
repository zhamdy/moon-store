import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getDefaultRoute } from '@/shared/lib/authRedirect';

export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: ({ context }) => {
    if (context.auth.user?.role !== 'Admin') {
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
