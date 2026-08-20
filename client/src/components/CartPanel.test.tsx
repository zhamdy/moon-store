import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../lib/transport';
import type { TransportRequest, TransportResult } from '../lib/transport';
import { createMemoryTransport, type MemoryTransport } from '../lib/transport/memory';
import { useSettingsStore } from '../store/settingsStore';
import { useCartStore } from '../store/cartStore';
import { useOfflineStore } from '../store/offlineStore';
import CartPanel from './CartPanel';

const SILK_DRESS = {
  product_id: 7,
  name: 'Silk Dress',
  unit_price: 250,
  quantity: 2,
  stock: 5,
  memo: 'gift wrap',
};

/**
 * The memory transport echoes a POST body back as the created row, but a real
 * sale returns server-side columns the receipt reads. Those are layered on so
 * the success path completes; every assertion here is about the request.
 */
function withSaleReply(memory: MemoryTransport): MemoryTransport {
  return {
    ...memory,
    async request<T>(req: TransportRequest): Promise<TransportResult<T>> {
      const result = await memory.request<T>(req);
      if (req.method === 'POST' && req.path === 'sales') {
        return {
          data: {
            ...(result.data as Record<string, unknown>),
            total: 480,
            cashier_name: 'Sarah',
            created_at: '2026-02-01T10:00:00.000Z',
          } as T,
        };
      }
      return result;
    },
  };
}

function makeTransport() {
  return withSaleReply(
    createMemoryTransport(
      { customers: [] },
      { reads: { settings: { tax_enabled: 'false', loyalty_enabled: 'false' } } }
    )
  );
}

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

function openCheckout() {
  fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
  return screen.findByRole('button', { name: 'Confirm Sale' });
}

describe('CartPanel checkout', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useOfflineStore.setState({ queue: [], isSyncing: false });
    useCartStore.setState({
      items: [SILK_DRESS],
      discount: 10,
      discountType: 'percentage',
      notes: 'call before delivery',
      tip: 5,
      couponCode: 'SUMMER20',
      couponDiscount: 20,
    });
  });

  it('posts the sale exactly as the till composed it', async () => {
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await openCheckout());

    await waitFor(() =>
      expect(
        transport.calls().some((call) => call.method === 'POST' && call.path === 'sales')
      ).toBe(true)
    );

    const sale = transport.calls().find((call) => call.path === 'sales');
    expect(sale?.body).toEqual({
      items: [{ product_id: 7, quantity: 2, unit_price: 250, memo: 'gift wrap' }],
      discount: 10,
      discount_type: 'percentage',
      payment_method: 'Cash',
      notes: 'call before delivery',
      tip: 5,
      coupon_code: 'SUMMER20',
    });
    // Optional fields stay off the body entirely rather than going up as null.
    expect(sale?.body).not.toHaveProperty('customer_id');
    expect(sale?.body).not.toHaveProperty('points_redeemed');
    expect(sale?.body).not.toHaveProperty('payments');
  });

  it('clears the cart once the sale lands', async () => {
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await openCheckout());

    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0));
    expect(useOfflineStore.getState().queue).toHaveLength(0);
  });

  it('queues the sale offline when the post fails with no connection', async () => {
    const transport = makeTransport();
    const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      render(<CartPanel />, { wrapper: wrapperFor(transport) });

      transport.failNext('', 500);
      fireEvent.click(await openCheckout());

      await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(1));

      // The queued payload is the reduced one the offline path builds, not the
      // full checkout body: no notes, tip or coupon.
      expect(useOfflineStore.getState().queue[0]).toMatchObject({
        type: 'sale',
        payload: {
          items: [{ product_id: 7, quantity: 2, unit_price: 250 }],
          discount: 10,
          discount_type: 'percentage',
          payment_method: 'Cash',
        },
      });
      expect(useCartStore.getState().items).toHaveLength(0);
    } finally {
      if (online) Object.defineProperty(Navigator.prototype, 'onLine', online);
    }
  });
});
