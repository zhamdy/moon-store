import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import toast from 'react-hot-toast';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { loadExportUtils, type ExportUtils } from '../../../shared/lib/loadExportUtils';
import SalesHistory from './SalesHistory';
import type { Sale } from '../types';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// The export chunk is reached only through this loader (#184).
vi.mock('../../../shared/lib/loadExportUtils', () => ({ loadExportUtils: vi.fn() }));

const SALE: Sale = {
  id: 41,
  total: 1200,
  discount: null,
  discount_type: null,
  payment_method: 'cash',
  cashier_id: 2,
  cashier_name: 'Sarah',
  items_count: 1,
  created_at: '2026-09-01T10:00:00Z',
  refund_status: null,
  refunded_amount: null,
  customer_id: null,
  customer_name: null,
};

function transportWithSale() {
  return createMemoryTransport(
    { sales: [SALE] },
    {
      meta: {
        sales: {
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
          aggregates: { totalRevenue: 1200, totalSales: 1 },
        },
      },
    }
  );
}

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

describe('SalesHistory export', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    vi.mocked(loadExportUtils).mockReset();
    vi.mocked(toast.error).mockClear();
  });

  it('writes the listed sales through the lazily loaded export chunk', async () => {
    const exportToExcel = vi.fn();
    vi.mocked(loadExportUtils).mockResolvedValue({ exportToExcel } as unknown as ExportUtils);
    render(<SalesHistory />, { wrapper: wrapperFor(transportWithSale()) });

    await screen.findByText('Sarah');
    expect(loadExportUtils).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Export CSV$/ }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalledTimes(1));
    const [filename, rows] = exportToExcel.mock.calls[0];
    expect(filename).toMatch(/^moon-sales-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(rows).toEqual([expect.objectContaining({ id: 41, cashier_name: 'Sarah' })]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows an error toast when the export chunk fails to load', async () => {
    vi.mocked(loadExportUtils).mockRejectedValue(
      new TypeError('Failed to fetch dynamically imported module')
    );
    render(<SalesHistory />, { wrapper: wrapperFor(transportWithSale()) });

    await screen.findByText('Sarah');
    fireEvent.click(screen.getByRole('button', { name: /^Export CSV$/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Export failed. Check your connection and try again.'
      )
    );
  });
});
