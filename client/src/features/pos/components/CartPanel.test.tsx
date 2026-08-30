import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import type { TransportRequest, TransportResult } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useCartStore } from '../store/cartStore';
import { useOfflineStore } from '../../../shared/store/offlineStore';
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
 * sale returns the additive `calculation`/`items`/`payments` fields (Unit 4)
 * the receipt is built from. Those are layered on so the success path
 * completes with a realistic confirmed response; request-shape assertions
 * are unaffected, and receipt-construction tests assert against these exact
 * confirmed values.
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
            // Deliberately DIFFERENT numbers than a naive client recomputation
            // from the cart (discount 10%, tip 5, coupon 20 on a 500 subtotal
            // would preview 425) -- proving the receipt renders the
            // server-CONFIRMED breakdown, not a client-side reconstruction.
            calculation: {
              subtotal: 500,
              manualDiscount: 50,
              couponDiscount: 20,
              pointsDiscount: 0,
              taxAmount: 0,
              taxMode: 'exclusive',
              taxRatePercent: 0,
              tipAmount: 5,
              amountDue: 435,
            },
            items: [{ product_id: 7, variant_id: null, quantity: 2, unit_price: 250 }],
            payments: [{ method: 'Cash', amount: 435 }],
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

  it('builds the receipt solely from the confirmed server response, not a client recomputation', async () => {
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await openCheckout());

    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0));

    // The confirmed amountDue (435), not the client preview total the cart
    // would have shown pre-checkout for this same discount/tip/coupon combo.
    expect(await screen.findByText('435 EG')).toBeInTheDocument();
    // Manual discount amount from `calculation.manualDiscount` (50), not a
    // client-recomputed 10% of the subtotal. (The closing checkout drawer can
    // still show its own now-stale line as it animates out, so assert
    // presence rather than uniqueness here.)
    expect(screen.getAllByText('-50 EG').length).toBeGreaterThan(0);
    // Coupon discount from the confirmed response.
    expect(screen.getAllByText('-20 EG').length).toBeGreaterThan(0);
    // Tip, added, from the confirmed response.
    expect(screen.getAllByText('+5 EG').length).toBeGreaterThan(0);
  });

  it('stamps a new offline queue entry with the current contract version', async () => {
    const transport = makeTransport();
    const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      render(<CartPanel />, { wrapper: wrapperFor(transport) });

      transport.failNext('', 500);
      fireEvent.click(await openCheckout());

      await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(1));
      expect(useOfflineStore.getState().queue[0].contractVersion).toBe('v1');
    } finally {
      if (online) Object.defineProperty(Navigator.prototype, 'onLine', online);
    }
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

describe('CartPanel recovered-cart review banner', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useOfflineStore.setState({ queue: [], isSyncing: false });
  });

  it('shows a review banner for a cart flagged needsReview, and clears it on acknowledgement', async () => {
    useCartStore.setState({ items: [SILK_DRESS], needsReview: true });
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    const banner = await screen.findByText(/review its discount, tip and coupon/i);
    expect(banner).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reviewed' }));

    await waitFor(() =>
      expect(screen.queryByText(/review its discount, tip and coupon/i)).not.toBeInTheDocument()
    );
    expect(useCartStore.getState().needsReview).toBe(false);
  });

  it('does not show the review banner for a normal cart', () => {
    useCartStore.setState({ items: [SILK_DRESS], needsReview: false });
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    expect(screen.queryByText(/review its discount, tip and coupon/i)).not.toBeInTheDocument();
  });
});
