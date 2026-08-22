import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import SalesHistory from './SalesHistory';

function wrapperFor(transport: MemoryTransport) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('SalesHistory server listing', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('keeps sensitive search in component state and sends canonical pagination', async () => {
    const transport = createMemoryTransport(
      { sales: [] },
      {
        meta: {
          sales: {
            pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
            aggregates: { totalRevenue: 0, totalSales: 0 },
          },
        },
      }
    );
    render(<SalesHistory />, { wrapper: wrapperFor(transport) });

    const search = await screen.findByRole('searchbox');
    fireEvent.change(search, { target: { value: 'private receipt' } });

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'sales',
          params: expect.objectContaining({
            page: '1',
            pageSize: '25',
            search: 'private receipt',
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        })
      )
    );
    expect(window.location.search).not.toContain('private');
  });
});
