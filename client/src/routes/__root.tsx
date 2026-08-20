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
