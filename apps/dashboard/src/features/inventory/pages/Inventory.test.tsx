import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { loadExportUtils, type ExportUtils } from '../../../shared/lib/loadExportUtils';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useAuthStore } from '../../auth';
import type { Product } from '../../../shared/types/index';
import { renderWithRouter } from '../../../shared/tests/routerTestUtils';
import Inventory from './Inventory';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// The export chunk is reached only through this loader (#184); mocking it proves the page
// goes through the lazy path, since a static import of `exportUtils` would bypass it.
vi.mock('../../../shared/lib/loadExportUtils', () => ({ loadExportUtils: vi.fn() }));

const SILK_DRESS: Product = {
  id: 1,
  name: 'Silk Dress',
  sku: 'DRS-001',
  barcode: '100000000001',
  price: 1200,
  cost_price: 600,
  stock: 4,
  min_stock: 5,
  category: 'Dresses',
  category_id: 3,
  category_name: 'Dresses',
  category_code: 'DRS',
  distributor_id: null,
  distributor_name: null,
  image_url: null,
  has_variants: 0,
  variant_count: 0,
  variant_stock: 0,
  status: 'active',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const CASHMERE_COAT: Product = {
  ...SILK_DRESS,
  id: 2,
  name: 'Cashmere Coat',
  sku: 'COT-002',
  barcode: '100000000002',
  stock: 12,
};

function transportWithProducts() {
  return createMemoryTransport(
    { products: [SILK_DRESS, CASHMERE_COAT], distributors: [] },
    // `categories` and `low-stock` hang off the products collection rather than
    // naming a record, so the fake serves them as canned reads.
    { reads: { 'products/categories': [{ id: 3, name: 'Dresses', code: 'DRS' }] } }
  );
}

function renderInventory(transport: MemoryTransport) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderWithRouter(
    <TransportProvider transport={transport}>
      <Inventory />
    </TransportProvider>,
    {
      queryClient,
      initialRoute: '/inventory',
      authState: {
        isAuthenticated: true,
        user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      },
    }
  );
}

/** Tick the row checkbox for the nth product row; index 0 is the select-all box. */
function selectRow(index: number) {
  fireEvent.click(screen.getAllByRole('checkbox')[index]);
}

describe('Inventory bulk operations', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    // Bulk actions and row selection are admin-only.
    useAuthStore.setState({
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      accessToken: 'test-token',
      isAuthenticated: true,
    });
  });

  it('sends the selected ids to the bulk discontinue endpoint', async () => {
    const transport = transportWithProducts();

    renderInventory(transport);
    await screen.findByText('Silk Dress');

    selectRow(1);
    fireEvent.click(await screen.findByRole('button', { name: /Discontinue/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Confirm$/i }));

    // The fake server has no route for a collection-level action — it addresses
    // records — so this asserts the request the page put on the wire, which is
    // the part the migration had to keep right.
    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          path: 'products/bulk-delete',
          body: { ids: [1] },
        })
      )
    );
    // The whole inventory table, its dialogs and its animations mount for this,
    // which takes longer than the default per-test budget on a cold run.
  }, 20000);

  it('sends the selected ids and the change to the bulk update endpoint', async () => {
    const transport = transportWithProducts();

    renderInventory(transport);
    await screen.findByText('Silk Dress');

    selectRow(2);
    fireEvent.click(await screen.findByRole('button', { name: /Adjust Price/i }));
    fireEvent.change(await screen.findByPlaceholderText('+10 or -15'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /^Update$/i }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'PUT',
          path: 'products/bulk-update',
          body: { ids: [2], updates: { price_percent: 10 } },
        })
      )
    );
  }, 20000);

  it('requests the canonical server-side low-stock filter', async () => {
    const transport = createMemoryTransport(
      { products: [SILK_DRESS, CASHMERE_COAT], distributors: [] },
      {
        reads: {
          'products/categories': [],
        },
        meta: {
          products: {
            pagination: {
              page: 1,
              pageSize: 25,
              totalItems: 2,
              totalPages: 1,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          },
        },
      }
    );

    renderInventory(transport);
    await screen.findByText('Cashmere Coat');

    fireEvent.click(screen.getByRole('button', { name: /Low Stock Only/i }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          path: 'products',
          params: expect.objectContaining({
            lowStock: true,
            status: 'active',
            page: 1,
            pageSize: 25,
          }),
        })
      )
    );
    expect(await screen.findByText('Deficit')).toBeInTheDocument();
  }, 20000);

  it('exports the selected products through the lazily loaded export chunk', async () => {
    const exportToExcel = vi.fn();
    vi.mocked(loadExportUtils).mockResolvedValue({ exportToExcel } as unknown as ExportUtils);
    vi.mocked(toast.success).mockClear();

    renderInventory(transportWithProducts());
    await screen.findByText('Silk Dress');

    selectRow(1);
    fireEvent.click(await screen.findByRole('button', { name: /^Export CSV$/ }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalledTimes(1));
    const [filename, rows] = exportToExcel.mock.calls[0];
    expect(filename).toMatch(/^products-export-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(rows).toEqual([expect.objectContaining({ sku: 'DRS-001' })]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('1 products exported'));
  }, 20000);

  it('shows an error toast when the export chunk fails to load', async () => {
    vi.mocked(loadExportUtils).mockRejectedValue(
      new TypeError('Failed to fetch dynamically imported module')
    );
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    renderInventory(transportWithProducts());
    await screen.findByText('Silk Dress');

    selectRow(1);
    fireEvent.click(await screen.findByRole('button', { name: /^Export CSV$/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Export failed. Check your connection and try again.'
      )
    );
    expect(toast.success).not.toHaveBeenCalled();
  }, 20000);
});

describe('Inventory — distributor gating for non-Admin roles', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('never fetches GET distributors for a Cashier — it is Admin-only server-side (#172)', async () => {
    useAuthStore.setState({
      user: { id: 2, name: 'Sarah', email: 'sarah@moon.com', role: 'Cashier' },
      accessToken: 'test-token',
      isAuthenticated: true,
    });
    const transport = transportWithProducts();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    renderWithRouter(
      <TransportProvider transport={transport}>
        <Inventory />
      </TransportProvider>,
      {
        queryClient,
        initialRoute: '/inventory',
        authState: {
          isAuthenticated: true,
          user: { id: 2, name: 'Sarah', email: 'sarah@moon.com', role: 'Cashier' },
        },
      }
    );

    await screen.findByText('Silk Dress');

    expect(transport.calls()).not.toContainEqual(
      expect.objectContaining({ method: 'GET', path: 'distributors' })
    );
  });
});

describe('Inventory product authoring fields', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useAuthStore.setState({
      user: { id: 1, name: 'Admin', email: 'admin@moon.com', role: 'Admin' },
      accessToken: 'test-token',
      isAuthenticated: true,
    });
  });

  function authoringTransport() {
    return createMemoryTransport(
      { products: [SILK_DRESS, CASHMERE_COAT], distributors: [] },
      {
        reads: {
          'products/categories': [{ id: 3, name: 'Dresses', code: 'DRS' }],
          'products/1/images': [],
        },
      }
    );
  }

  it('fills the untouched slug from the English name and stops once it is edited', async () => {
    renderInventory(authoringTransport());
    await screen.findByText('Silk Dress');

    fireEvent.click(screen.getByRole('button', { name: /^Add Product$/ }));
    const nameEn = await screen.findByLabelText('English name');
    const slug = screen.getByLabelText('URL slug') as HTMLInputElement;

    fireEvent.change(nameEn, { target: { value: 'Silk Evening Dress' } });
    await waitFor(() => expect(slug.value).toBe('silk-evening-dress'));

    fireEvent.change(slug, { target: { value: 'house-dress' } });
    fireEvent.change(nameEn, { target: { value: 'Another Name' } });
    await waitFor(() => expect(slug.value).toBe('house-dress'));
    expect(screen.getByText('Changing this breaks existing links')).toBeInTheDocument();
  }, 20000);

  it('shows a 409 slug refusal inline on the slug field and keeps the dialog open', async () => {
    const transport = authoringTransport();
    vi.mocked(toast.error).mockClear();
    renderInventory(transport);
    await screen.findByText('Silk Dress');

    fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]);
    fireEvent.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    fireEvent.change(await screen.findByLabelText('URL slug'), {
      target: { value: 'evening-dress' },
    });

    transport.failNext(
      'Slug already in use',
      409,
      'CONFLICT',
      [{ field: 'slug', code: 'SLUG_TAKEN', message: 'Slug already in use' }],
      'products/1'
    );
    fireEvent.click(screen.getByRole('button', { name: /^Update$/ }));

    expect(
      await screen.findByText('This slug is already in use. Choose another.')
    ).toBeInTheDocument();
    expect(transport.calls()).toContainEqual(
      expect.objectContaining({
        method: 'PUT',
        path: 'products/1',
        body: expect.objectContaining({ slug: 'evening-dress', name_en: null }),
      })
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  }, 20000);
});
