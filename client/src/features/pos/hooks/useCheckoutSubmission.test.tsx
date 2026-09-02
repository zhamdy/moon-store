import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  TransportProvider,
  isValidIdempotencyKey,
  type TransportRequest,
  type TransportResult,
} from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useOfflineStore } from '../../../shared/store/offlineStore';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useCartStore } from '../store/cartStore';
import { useCheckoutSubmission } from './useCheckoutSubmission';
import type { SaleComposition } from '../lib/salePayload';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

/**
 * Submission behaviour, driven directly — no CartPanel, no drawer, no POS
 * screen. This is the other half of issue #51's "testable independently"
 * criterion (calculation is covered by useCheckoutPricing.test.tsx).
 */

const SILK_DRESS = {
  product_id: 7,
  name: 'Silk Dress',
  unit_price: 250,
  quantity: 2,
  stock: 5,
};

const COMPOSITION: SaleComposition = {
  items: [SILK_DRESS],
  discount: 10,
  discountType: 'percentage',
  notes: 'call before delivery',
  tip: 5,
  couponCode: 'SUMMER20',
  paymentMethod: 'Cash',
  splitPayment: false,
  payments: [],
  customerId: null,
  pointsToRedeem: 0,
};

function withSaleReply(memory: MemoryTransport): MemoryTransport {
  return {
    ...memory,
    async request<T>(req: TransportRequest): Promise<TransportResult<T>> {
      const result = await memory.request<T>(req);
      if (req.method === 'POST' && req.path === 'sales') {
        return {
          data: {
            ...(result.data as Record<string, unknown>),
            id: 91,
            total: 480,
            payment_method: 'Cash',
            cashier_name: 'Sarah',
            created_at: '2026-02-01T10:00:00.000Z',
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

function renderSubmission(transport: MemoryTransport) {
  const settled = vi.fn();
  const rendered = renderHook(
    () =>
      useCheckoutSubmission({
        tax: { enabled: false, rate: 0, mode: 'exclusive' },
        customerName: 'Amina',
        onCheckoutSettled: settled,
      }),
    { wrapper: wrapperFor(transport) }
  );
  return { ...rendered, settled };
}

/** Runs `body` with the browser reporting itself offline, then restores jsdom's getter. */
async function whileOffline(body: () => Promise<void>) {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  try {
    await body();
  } finally {
    delete (navigator as { onLine?: boolean }).onLine;
  }
}

describe('useCheckoutSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      needsReview: false,
      checkoutAttempt: null,
    });
  });

  it('posts the composed body under a well-formed idempotency key', async () => {
    const transport = withSaleReply(createMemoryTransport());
    const { result } = renderSubmission(transport);

    act(() => result.current.submit(COMPOSITION));

    await waitFor(() => expect(transport.idempotencyKeys()).toHaveLength(1));
    expect(transport.calls().find((c) => c.path === 'sales')?.body).toEqual({
      items: [{ product_id: 7, quantity: 2, unit_price: 250 }],
      discount: 10,
      discount_type: 'percentage',
      payment_method: 'Cash',
      notes: 'call before delivery',
      tip: 5,
      coupon_code: 'SUMMER20',
    });
    expect(isValidIdempotencyKey(transport.idempotencyKeys()[0])).toBe(true);
  });

  it('clears the cart, resets the surrounding UI and opens the confirmed receipt', async () => {
    const transport = withSaleReply(createMemoryTransport());
    const { result, settled } = renderSubmission(transport);

    act(() => result.current.submit(COMPOSITION));

    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0));
    expect(settled).toHaveBeenCalledTimes(1);
    expect(useCartStore.getState().checkoutAttempt).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Sale completed successfully!');

    await waitFor(() => expect(result.current.receiptOpen).toBe(true));
    // Every figure on the receipt is the server's confirmed one.
    expect(result.current.receiptData?.saleId).toBe(91);
    expect(result.current.receiptData?.calculation.amountDue).toBe(435);
    expect(result.current.receiptData?.items).toEqual([
      { name: 'Silk Dress', quantity: 2, unit_price: 250 },
    ]);
    expect(result.current.receiptData?.customerName).toBe('Amina');
  });

  it('retries an unchanged cart under the SAME key, and leaves the cart alone to allow it', async () => {
    const transport = withSaleReply(createMemoryTransport());
    const { result, settled } = renderSubmission(transport);

    transport.failNext('Gateway timeout', 502, undefined, undefined, 'sales');
    act(() => result.current.submit(COMPOSITION));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Gateway timeout'));
    // A failure the cashier can retry: nothing cleared, nothing closed.
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(settled).not.toHaveBeenCalled();
    expect(useOfflineStore.getState().queue).toHaveLength(0);

    act(() => result.current.submit(COMPOSITION));
    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0));

    const keys = transport.idempotencyKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('mints a fresh key for a genuinely different sale', async () => {
    const transport = withSaleReply(createMemoryTransport());
    const { result } = renderSubmission(transport);

    transport.failNext('Gateway timeout', 502, undefined, undefined, 'sales');
    act(() => result.current.submit(COMPOSITION));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    act(() => result.current.submit({ ...COMPOSITION, tip: 25 }));
    await waitFor(() => expect(transport.idempotencyKeys()).toHaveLength(2));

    const [first, second] = transport.idempotencyKeys();
    expect(second).not.toBe(first);
  });

  it('names the stale-split failure specifically, and keeps the cart for rebalancing', async () => {
    const transport = withSaleReply(createMemoryTransport());
    const { result, settled } = renderSubmission(transport);

    transport.failNext(
      'Payments no longer balance',
      400,
      'VALIDATION_ERROR',
      [{ field: 'payments', code: 'SPLIT_PAYMENT_MISMATCH', message: 'stale split' }],
      'sales'
    );
    act(() =>
      result.current.submit({
        ...COMPOSITION,
        splitPayment: true,
        payments: [{ method: 'Cash', amount: 500 }],
      })
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'The total or payments changed since checkout was opened. Review the amount due and rebalance payments before confirming.'
      )
    );
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(settled).not.toHaveBeenCalled();
  });

  /**
   * The offline fallback is currently UNREACHABLE from the real checkout path
   * (React Query pauses a mutation fired while offline rather than failing it
   * — issue #53). These drive `onError` directly, which is exactly what the
   * fix for #53 will make reachable, so the behaviour must not rot meanwhile.
   */
  it('queues the sale that was actually attempted, stamped and keyed, when the post fails offline', async () => {
    await whileOffline(async () => {
      const transport = withSaleReply(createMemoryTransport());
      const { result, settled } = renderSubmission(transport);

      transport.failNext('', 500, undefined, undefined, 'sales');
      act(() => result.current.submit(COMPOSITION));

      await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(1));
      const [queued] = useOfflineStore.getState().queue;

      // The reduced offline body: no notes, tip or coupon.
      expect(queued).toMatchObject({
        type: 'sale',
        contractVersion: 'v1',
        payload: {
          items: [{ product_id: 7, quantity: 2, unit_price: 250 }],
          discount: 10,
          discount_type: 'percentage',
          payment_method: 'Cash',
        },
      });
      // Same key the failed POST carried, so a replay that already landed is deduped.
      expect(queued.idempotencyKey).toBe(transport.idempotencyKeys()[0]);
      expect(useCartStore.getState().items).toHaveLength(0);
      expect(useCartStore.getState().checkoutAttempt).toBeNull();
      expect(settled).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Sale saved offline. Will sync when back online.');
    });
  });

  it('queues the composition it was handed, not whatever the cart says afterwards', async () => {
    await whileOffline(async () => {
      const transport = withSaleReply(createMemoryTransport());
      const { result } = renderSubmission(transport);

      transport.failNext('', 500, undefined, undefined, 'sales');
      act(() => {
        result.current.submit({ ...COMPOSITION, paymentMethod: 'Card', customerId: 42 });
        // The cart moves on while the request is in flight.
        useCartStore.setState({ items: [{ ...SILK_DRESS, product_id: 99, quantity: 1 }] });
      });

      await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(1));
      expect(useOfflineStore.getState().queue[0].payload).toMatchObject({
        items: [{ product_id: 7, quantity: 2, unit_price: 250 }],
        payment_method: 'Card',
        customer_id: 42,
      });
    });
  });
});
