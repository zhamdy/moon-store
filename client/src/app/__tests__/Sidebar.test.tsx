import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/features/auth';
import { useSettingsStore } from '@/shared/store/settingsStore';
import { renderWithRouter } from '@/shared/tests/routerTestUtils';
import Sidebar from '../Sidebar';

describe('Sidebar navigation', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it('renders all sections for Admin user', async () => {
    useAuthStore.setState({
      user: { id: 1, name: 'Admin User', email: 'admin@moon.com', role: 'Admin' },
      isAuthenticated: true,
    });

    renderWithRouter(<Sidebar />, {
      initialRoute: '/',
      authState: {
        isAuthenticated: true,
        user: { id: 1, name: 'Admin User', email: 'admin@moon.com', role: 'Admin' },
      },
    });

    const dashboards = await screen.findAllByText(/Dashboard/i);
    expect(dashboards.length).toBeGreaterThan(0);

    const settings = await screen.findAllByText(/Settings/i);
    expect(settings.length).toBeGreaterThan(0);

    const users = await screen.findAllByText(/Users/i);
    expect(users.length).toBeGreaterThan(0);
  });

  it('renders only permitted items for Cashier user', async () => {
    useAuthStore.setState({
      user: { id: 2, name: 'Cashier User', email: 'cashier@moon.com', role: 'Cashier' },
      isAuthenticated: true,
    });

    renderWithRouter(<Sidebar />, {
      initialRoute: '/pos',
      authState: {
        isAuthenticated: true,
        user: { id: 2, name: 'Cashier User', email: 'cashier@moon.com', role: 'Cashier' },
      },
    });

    const posItems = await screen.findAllByText(/Point of Sale/i);
    expect(posItems.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Users/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Settings/i)).not.toBeInTheDocument();
  });

  it('calls logout when logout button is clicked', async () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');
    useAuthStore.setState({
      user: { id: 1, name: 'Admin User', email: 'admin@moon.com', role: 'Admin' },
      isAuthenticated: true,
    });

    renderWithRouter(<Sidebar />, {
      initialRoute: '/',
      authState: {
        isAuthenticated: true,
        user: { id: 1, name: 'Admin User', email: 'admin@moon.com', role: 'Admin' },
      },
    });

    const logoutBtns = await screen.findAllByRole('button', { name: /Logout/i });
    fireEvent.click(logoutBtns[0]);

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
    });
  });

  it('renders mobile drawer when mobileOpen is true', async () => {
    useAuthStore.setState({
      user: { id: 1, name: 'Admin User', email: 'admin@moon.com', role: 'Admin' },
      isAuthenticated: true,
    });

    renderWithRouter(<Sidebar mobileOpen={true} />, {
      initialRoute: '/',
      authState: {
        isAuthenticated: true,
        user: { id: 1, name: 'Admin User', email: 'admin@moon.com', role: 'Admin' },
      },
    });

    const dashboards = await screen.findAllByText(/Dashboard/i);
    expect(dashboards.length).toBeGreaterThan(1);
  });
});
