import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('deactivates a branch through the soft-deactivate action, never a DELETE', async () => {
    const transport = createMemoryTransport({
      branches: [
        {
          id: 2,
          name: 'Zamalek Store',
          type: 'Store',
          status: 'active',
          is_main: 0,
          product_count: 0,
        },
      ],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<BranchesPage />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await screen.findByRole('button', { name: 'Zamalek Store: Deactivate' }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'POST', path: 'branches/2/deactivate' })
      )
    );
    expect(transport.calls().some((call) => call.method === 'DELETE')).toBe(false);
    confirmSpy.mockRestore();
  });

  it('shows an inactive branch as inactive and offers no deactivate action on it', async () => {
    const transport = createMemoryTransport({
      branches: [
        {
          id: 3,
          name: 'Heliopolis Store',
          type: 'Store',
          status: 'inactive',
          is_main: 0,
          product_count: 0,
        },
      ],
    });
    render(<BranchesPage />, { wrapper: wrapperFor(transport) });

    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Heliopolis Store: Deactivate' })
    ).not.toBeInTheDocument();
  });

  /**
   * Issue #188: the page read `is_primary`, a field the server never sends, so the main
   * branch offered a Deactivate the server refuses with 409. Rows below mirror
   * `BranchRepository.findAllWithInventory`, where `is_main` is the raw INTEGER column.
   */
  it('offers no deactivate action on the main branch and marks it as primary', async () => {
    const row = {
      code: '',
      address: null,
      phone: null,
      currency: 'EGP',
      status: 'active',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
      product_count: 0,
      total_stock: 0,
    };
    const transport = createMemoryTransport({
      branches: [
        { ...row, id: 1, name: 'Maadi Store', code: 'MAADI', is_main: 1 },
        { ...row, id: 2, name: 'Zamalek Store', code: 'ZMLK', is_main: 0 },
      ],
    });
    render(<BranchesPage />, { wrapper: wrapperFor(transport) });

    expect(
      await screen.findByRole('button', { name: 'Zamalek Store: Deactivate' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Maadi Store: Deactivate' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Primary')).toHaveLength(1);
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
