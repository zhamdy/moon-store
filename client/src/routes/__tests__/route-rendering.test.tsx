import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '../../routeTree.gen';
import { useAuthStore } from '@/features/auth';
import type { AuthUser } from '@/shared/types';

vi.mock('@/app/Layout', () => ({
  default: () => <div data-testid="layout-shell">Layout Shell</div>,
}));

describe('Route rendering and access control', () => {
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

  const adminUser: AuthUser = { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' };
  const cashierUser: AuthUser = {
    id: 2,
    name: 'Cashier',
    email: 'cashier@moon.com',
    role: 'Cashier',
  };
  const deliveryUser: AuthUser = {
    id: 3,
    name: 'Driver',
    email: 'driver@moon.com',
    role: 'Delivery',
  };

  it('allows Admin to access dashboard (/)', async () => {
    const router = createTestRouter('/', {
      isAuthenticated: true,
      user: adminUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('allows Admin to access pos (/pos)', async () => {
    const router = createTestRouter('/pos', {
      isAuthenticated: true,
      user: adminUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/pos');
    });
  });

  it('allows Cashier to access pos (/pos)', async () => {
    const router = createTestRouter('/pos', {
      isAuthenticated: true,
      user: cashierUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/pos');
    });
  });

  it('prevents Delivery role from accessing pos (/pos) and redirects to /deliveries', async () => {
    const router = createTestRouter('/pos', {
      isAuthenticated: true,
      user: deliveryUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/deliveries');
    });
  });

  it('allows Delivery role to access deliveries (/deliveries)', async () => {
    const router = createTestRouter('/deliveries', {
      isAuthenticated: true,
      user: deliveryUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/deliveries');
    });
  });

  it('prevents Cashier role from accessing deliveries (/deliveries) and redirects to /pos', async () => {
    const router = createTestRouter('/deliveries', {
      isAuthenticated: true,
      user: cashierUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/pos');
    });
  });

  it('allows Admin to access settings (/settings)', async () => {
    const router = createTestRouter('/settings', {
      isAuthenticated: true,
      user: adminUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/settings');
    });
  });

  it('prevents Cashier from accessing settings (/settings) and redirects to /pos', async () => {
    const router = createTestRouter('/settings', {
      isAuthenticated: true,
      user: cashierUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/pos');
    });
  });
it('allows Admin to access collections (/collections)', async () => {
    const router = createTestRouter('/collections', {
      isAuthenticated: true,
      user: adminUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections');
    });
  });

  it('prevents Cashier from accessing collections (/collections) and redirects to /pos', async () => {
    const router = createTestRouter('/collections', {
      isAuthenticated: true,
      user: cashierUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/pos');
    });
  });

  it('allows Admin to access warranty (/warranty)', async () => {
    const router = createTestRouter('/warranty', {
      isAuthenticated: true,
      user: adminUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/warranty');
    });
  });

  it('prevents Cashier from accessing warranty (/warranty) and redirects to /pos', async () => {
    const router = createTestRouter('/warranty', {
      isAuthenticated: true,
      user: cashierUser,
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/pos');
    });
  });
});
