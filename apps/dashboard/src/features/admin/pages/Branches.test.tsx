import { beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import BranchesPage from './Branches';

function wrapperFor(transport: MemoryTransport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('Branches manager selector', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('loads paginated users only while the branch editor is open', async () => {
    const transport = createMemoryTransport({ branches: [], users: [] });
    render(<BranchesPage />, { wrapper: wrapperFor(transport) });
    await screen.findByRole('heading', { name: 'Branch Management' });
    expect(transport.calls().some((call) => call.path === 'users')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Add Branch' }));
    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'users',
          params: expect.objectContaining({ page: 1, pageSize: 25, sortBy: 'name' }),
        })
      )
    );
  });

  it('requests transfer filtering and pagination from the backend', async () => {
    const transport = createMemoryTransport(
      { branches: [] },
      { reads: { 'branches/transfers': [] } }
    );
    render(<BranchesPage />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await screen.findByRole('button', { name: 'Stock Transfers' }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'branches/transfers',
          params: expect.objectContaining({
            page: 1,
            pageSize: 25,
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        })
      )
    );

    fireEvent.click(screen.getByLabelText('Transfer status'));
    const completedOptions = await screen.findAllByText('Completed');
    fireEvent.click(completedOptions[completedOptions.length - 1]);

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          path: 'branches/transfers',
          params: expect.objectContaining({ status: 'completed', page: 1 }),
        })
      )
    );
  });

  /**
   * The server never served `branches/dashboard/consolidated` -- only
   * `GET /api/v1/branches/consolidated`, returning one row per branch with
   * `stats.products`/`stats.stock` rather than the sales/revenue shape this page used to
   * assume (issue #163). Confirms the page now asks for the real path and reads the real
   * shape back.
   */
  it('reads the consolidated dashboard from the endpoint the server actually serves', async () => {
    const transport = createMemoryTransport(
      { branches: [] },
      {
        reads: {
          'branches/consolidated': [
            {
              id: 1,
              name: 'Maadi Store',
              code: 'MAADI',
              is_main: 1,
              stats: { products: 40, stock: 120 },
            },
            {
              id: 2,
              name: 'Zamalek Store',
              code: 'ZMLK',
              is_main: 0,
              stats: { products: 25, stock: 60 },
            },
          ],
        },
      }
    );
    render(<BranchesPage />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await screen.findByRole('button', { name: 'Consolidated' }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'GET', path: 'branches/consolidated' })
      )
    );
    expect(transport.calls().some((call) => call.path === 'branches/dashboard/consolidated')).toBe(
      false
    );

    expect(await screen.findByText('Maadi Store')).toBeInTheDocument();
    expect(screen.getByText('Zamalek Store')).toBeInTheDocument();
    // Two stores' worth of stock (120 + 60), not a per-branch revenue figure the schema
    // cannot supply.
    expect(screen.getByText('180')).toBeInTheDocument();
  });
});
