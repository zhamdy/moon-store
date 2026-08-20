import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '../../routeTree.gen';
import { getDefaultRoute } from '@/shared/lib/authRedirect';
import { useAuthStore } from '@/features/auth';
import type { AuthUser } from '@/shared/types';
import { router } from '@/app/router';
import { emitSessionEvent } from '@/shared/lib/session';
import '@/app/session';

vi.mock('@/app/Layout', () => ({
  default: () => <div data-testid="layout">Layout Component</div>,
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth')>('@/features/auth');
  return {
    ...actual,
    Login: () => <div data-testid="login-page">Login Page</div>,
  };
});

vi.mock('@/features/pos', async () => {
  const actual = await vi.importActual<typeof import('@/features/pos')>('@/features/pos');
  return {
    ...actual,
    CustomerDisplay: () => <div data-testid="customer-display-page">Customer Display</div>,
  };
});

describe('getDefaultRoute', () => {
  it('returns / for Admin', () => {
    expect(getDefaultRoute({ id: 1, name: 'Admin', email: 'a@a.com', role: 'Admin' })).toBe('/');
  });

  it('returns /pos for Cashier', () => {
    expect(getDefaultRoute({ id: 2, name: 'Cashier', email: 'c@c.com', role: 'Cashier' })).toBe(
      '/pos'
    );
  });

  it('returns /deliveries for Delivery', () => {
    expect(getDefaultRoute({ id: 3, name: 'Delivery', email: 'd@d.com', role: 'Delivery' })).toBe(
      '/deliveries'
    );
  });

  it('returns /login for unauthenticated/null', () => {
    expect(getDefaultRoute(null)).toBe('/login');
    expect(getDefaultRoute(undefined)).toBe('/login');
  });
});

describe('TanStack Router Auth and Layout Guards', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  function createTestRouter(
    initialUrl: string,
    auth: { isAuthenticated: boolean; user: AuthUser | null }
  ) {
    const history = createMemoryHistory({ initialEntries: [initialUrl] });
    return createRouter({
      routeTree,
      history,
      context: {
        auth,
      },
    });
  }

  it('redirects unauthenticated users to /login when navigating to protected route', async () => {
    const router = createTestRouter('/', {
      isAuthenticated: false,
      user: null,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });

  it('renders CustomerDisplay without authentication', async () => {
    const router = createTestRouter('/customer-display', {
      isAuthenticated: false,
      user: null,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/customer-display');
      expect(screen.getByTestId('customer-display-page')).toBeInTheDocument();
    });
  });

  it('redirects authenticated user accessing /login to role default route', async () => {
    const adminUser: AuthUser = { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' };
    const router = createTestRouter('/login', {
      isAuthenticated: true,
      user: adminUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('redirects non-admin (Cashier) accessing admin route to role default (/pos)', async () => {
    const cashierUser: AuthUser = {
      id: 2,
      name: 'Cashier',
      email: 'cashier@moon.com',
      role: 'Cashier',
    };
    const router = createTestRouter('/', {
      isAuthenticated: true,
      user: cashierUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/pos');
    });
  });

  it('redirects non-admin (Delivery) accessing admin route to role default (/deliveries)', async () => {
    const deliveryUser: AuthUser = {
      id: 3,
      name: 'Driver',
      email: 'driver@moon.com',
      role: 'Delivery',
    };
    const router = createTestRouter('/', {
      isAuthenticated: true,
      user: deliveryUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/deliveries');
    });
  });

  it('redirects /locations to /branches via beforeLoad', async () => {
    const { Route: LocationsRoute } = await import('../locations');
    try {
      // @ts-expect-error calling beforeLoad directly for unit test
      await LocationsRoute.options.beforeLoad?.({} as never);
      expect.unreachable('Should have thrown redirect');
    } catch (err: unknown) {
      const redirectErr = err as { options?: { to?: string }; to?: string; href?: string };
      const target = redirectErr?.options?.to || redirectErr?.to || redirectErr?.href;
      expect(target).toBe('/branches');
    }
  });

  it('redirects unknown route to /login for unauthenticated users', async () => {
    const router = createTestRouter('/some-non-existent-page', {
      isAuthenticated: false,
      user: null,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });

  it('redirects unknown route to role default for authenticated Admin', async () => {
    const router = createTestRouter('/some-non-existent-page', {
      isAuthenticated: true,
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('invalidates router cache on session logout event', () => {
    const invalidateSpy = vi.spyOn(router, 'invalidate').mockReturnValue(Promise.resolve());
    emitSessionEvent('logout');
    expect(invalidateSpy).toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });
});
