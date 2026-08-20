import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import type { PurchaseOrder } from '@/types';
import PurchaseOrders from './PurchaseOrders';

const DRAFT_ORDER: PurchaseOrder = {
  id: 3,
  po_number: 'PO-0003',
  distributor_id: 1,
  distributor_name: 'Nile Textiles',
  status: 'Draft',
  total: 1800,
  notes: null,
  item_count: 2,
  created_by_name: 'Admin',
  created_at: '2026-02-01T09:00:00Z',
};

function wrapperFor(transport: MemoryTransport) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TransportProvider transport={transport}>{children}</TransportProvider>
    </QueryClientProvider>
  );
}

describe('PurchaseOrders', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }));

  it('lists the purchase orders the server holds', async () => {
    const transport = createMemoryTransport({ 'purchase-orders': [DRAFT_ORDER] });

    render(<PurchaseOrders />, { wrapper: wrapperFor(transport) });

    expect(await screen.findByText('PO-0003')).toBeInTheDocument();
    expect(transport.calls()).toContainEqual(
      expect.objectContaining({
        method: 'GET',
        path: 'purchase-orders',
        params: { limit: 200, status: undefined, distributor_id: undefined },
      })
    );
  });

  it('marks a draft order sent through the status sub-action', async () => {
    const transport = createMemoryTransport({ 'purchase-orders': [DRAFT_ORDER] });

    render(<PurchaseOrders />, { wrapper: wrapperFor(transport) });
    await screen.findByText('PO-0003');

    fireEvent.click(screen.getByTitle('Mark Sent'));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual({
        method: 'PUT',
        path: 'purchase-orders/3/status',
        body: { status: 'Sent' },
      })
    );
    expect(transport.peek('purchase-orders')[0].status).toBe('Sent');
  });

  it('receives items against the order being viewed', async () => {
    const transport = createMemoryTransport({
      'purchase-orders': [
        {
          ...DRAFT_ORDER,
          status: 'Sent',
          items: [
            {
              id: 11,
              po_id: 3,
              product_id: 5,
              variant_id: null,
              quantity: 4,
              received_quantity: 0,
              cost_price: 450,
              product_name: 'Silk Scarf',
              product_sku: 'SLK-01',
              variant_sku: null,
              variant_attributes: null,
            },
          ],
        },
      ],
    });

    render(<PurchaseOrders />, { wrapper: wrapperFor(transport) });
    await screen.findByText('PO-0003');

    // Opens the detail dialog straight into receive mode.
    fireEvent.click(screen.getByTitle('Receive Items'));
    await screen.findByText('Silk Scarf');

    fireEvent.change(screen.getByPlaceholderText('4'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Receive Items/i }));

    await waitFor(() =>
      expect(transport.calls()).toContainEqual({
        method: 'POST',
        path: 'purchase-orders/3/receive',
        body: { items: [{ item_id: 11, quantity: 3 }] },
      })
    );
  });
});
