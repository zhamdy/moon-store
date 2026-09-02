import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { ApiError } from '../../../shared/lib/transport/types';
import type { Transport, TransportRequest, TransportResult } from '../../../shared/lib/transport/types';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useAuthStore } from '../store/authStore';
import Login from './Login';

const { navigate, search } = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { redirect: undefined as string | undefined },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useSearch: () => search,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const CASHIER = { id: 2, name: 'Sarah', email: 'sarah@moon.com', role: 'Cashier' };

function transportFor(reply: () => unknown): Transport {
  return {
    async request<T>(_req: TransportRequest): Promise<TransportResult<T>> {
      const result = reply();
      if (result instanceof Error) throw result;
      return { data: result as T };
    },
  };
}

function renderLogin(transport: Transport) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
  return render(<Login />, { wrapper });
}

function signIn() {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'sarah@moon.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'cashier123' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in|login/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  search.redirect = undefined;
  useSettingsStore.setState({ locale: 'en' });
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
});

describe('signing in after a session expired mid-workflow', () => {
  it('returns the user to where they were', async () => {
    search.redirect = '/inventory?page=2';
    renderLogin(transportFor(() => ({ accessToken: 'fresh', user: CASHIER })));

    signIn();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/inventory?page=2' }));
  });

  it('falls back to the role home when no target was carried', async () => {
    renderLogin(transportFor(() => ({ accessToken: 'fresh', user: CASHIER })));

    signIn();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/pos' }));
  });

  it('refuses a target pointing off this origin even if one reaches the component', async () => {
    // The route's validateSearch already filters this; the component filters
    // again so it is safe to render outside that route.
    search.redirect = 'https://evil.example/steal';
    renderLogin(transportFor(() => ({ accessToken: 'fresh', user: CASHIER })));

    signIn();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/pos' }));
  });

  it('stays put and keeps what was typed when the credentials are rejected', async () => {
    renderLogin(transportFor(() => new ApiError('Invalid email or password', 401, 'UNAUTHORIZED')));

    signIn();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in|login/i })).toBeEnabled()
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(screen.getByLabelText(/email/i)).toHaveValue('sarah@moon.com');
  });
});
