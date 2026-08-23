import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useAuthStore } from '../../auth';
import UsersPage from './Users';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

function wrapperFor(transport: MemoryTransport) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('Users server listing', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      accessToken: 'test-token',
      isAuthenticated: true,
    });
  });

  it('debounces search and sends canonical server pagination', async () => {
    const transport = createMemoryTransport(
      { users: [] },
      {
        meta: {
          users: {
            pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
          },
        },
      }
    );
    render(<UsersPage />, { wrapper: wrapperFor(transport) });

    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'sarah' } });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'users',
          params: expect.objectContaining({
            page: 1,
            pageSize: 25,
            search: 'sarah',
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        })
      )
    );
  });
});
