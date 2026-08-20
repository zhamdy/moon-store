import type { ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree as appRouteTree } from '../../routeTree.gen';
import type { AuthUser } from '../types';

export interface RouterContext {
  auth: {
    isAuthenticated: boolean;
    user: AuthUser | null;
  };
}

export interface RenderWithRouterOptions {
  initialRoute?: string;
  authState?: {
    isAuthenticated: boolean;
    user: AuthUser | null;
  };
  queryClient?: QueryClient;
  useAppRoutes?: boolean;
}

export function createTestRouter(
  initialUrl = '/',
  auth: { isAuthenticated: boolean; user: AuthUser | null } = { isAuthenticated: false, user: null }
) {
  const history = createMemoryHistory({ initialEntries: [initialUrl] });
  return createRouter({
    routeTree: appRouteTree,
    history,
    context: {
      auth,
    },
  });
}

export function renderWithRouter(
  ui?: ReactNode,
  options: RenderWithRouterOptions = {}
): RenderResult & { router: ReturnType<typeof createTestRouter> } {
  const {
    initialRoute = '/',
    authState = { isAuthenticated: false, user: null },
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    }),
    useAppRoutes = false,
  } = options;

  let testRouter: ReturnType<typeof createTestRouter>;

  if (useAppRoutes || !ui) {
    testRouter = createTestRouter(initialRoute, authState);
  } else {
    const rootRoute = createRootRouteWithContext<RouterContext>()({
      component: () => <>{ui}</>,
    });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <>{ui}</>,
    });
    const catchAllRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '$',
      component: () => <>{ui}</>,
    });
    const customTree = rootRoute.addChildren([indexRoute, catchAllRoute]);
    const history = createMemoryHistory({ initialEntries: [initialRoute] });
    testRouter = createRouter({
      routeTree: customTree,
      history,
      context: {
        auth: authState,
      },
    });
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={testRouter} />
    </QueryClientProvider>
  );

  return {
    ...result,
    router: testRouter,
  };
}
