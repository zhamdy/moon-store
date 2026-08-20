import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../lib/transport/memory';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import type { Product } from '@/types';
import Inventory from './Inventory';

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

function wrapperFor(transport: MemoryTransport) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>
        <MemoryRouter>{children}</MemoryRouter>
      </TransportProvider>
    </QueryClientProvider>
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

    render(<Inventory />, { wrapper: wrapperFor(transport) });
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

    render(<Inventory />, { wrapper: wrapperFor(transport) });
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

  it('reads the low-stock endpoint rather than filtering the list it already has', async () => {
    const transport = createMemoryTransport(
      { products: [SILK_DRESS, CASHMERE_COAT], distributors: [] },
      {
        reads: {
          'products/categories': [],
          'products/low-stock': [{ ...SILK_DRESS, deficit: 1 }],
        },
      }
    );

    render(<Inventory />, { wrapper: wrapperFor(transport) });
    await screen.findByText('Cashmere Coat');

    fireEvent.click(screen.getByRole('button', { name: /Low Stock Only/i }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual(
        expect.objectContaining({ method: 'GET', path: 'products/low-stock' })
      )
    );
    expect(await screen.findByText('Deficit')).toBeInTheDocument();
  }, 20000);
});
