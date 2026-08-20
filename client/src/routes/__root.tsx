import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import PWAInstallPrompt from '@/shared/components/PWAInstallPrompt';
import type { AuthUser } from '@/shared/types';

export interface RouterContext {
  auth: {
    isAuthenticated: boolean;
    user: AuthUser | null;
  };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted mt-2">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center text-muted">Page not found</div>,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <PWAInstallPrompt />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  );
}
