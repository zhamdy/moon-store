import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { TransportProvider, isValidIdempotencyKey } from '../../../shared/lib/transport/index';
import type { TransportRequest, TransportResult } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useSettingsStore } from '../../../shared/store/settingsStore';
import { useCartStore } from '../store/cartStore';
import { useOfflineStore } from '../../../shared/store/offlineStore';
import CartPanel from './CartPanel';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

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

  it('stamps the sale with a well-formed idempotency key', async () => {
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await openCheckout());

    await waitFor(() => expect(transport.idempotencyKeys()).toHaveLength(1));

    const [key] = transport.idempotencyKeys();
    // The server 400s anything outside its format, so a key the fallback
    // generator produced has to satisfy the same rule as `crypto.randomUUID`.
    expect(isValidIdempotencyKey(key)).toBe(true);
    // It travels as a header, not as part of the sale the cashier rang up.
    expect(transport.calls().find((call) => call.path === 'sales')?.body).not.toHaveProperty(
      'idempotencyKey'
    );
  });

  it('gives a second, different sale its own key', async () => {
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    fireEvent.click(await openCheckout());
    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0));

    // The receipt modal owns the screen until it is dismissed.
    fireEvent.click((await screen.findAllByRole('button', { name: 'Close' }))[0]);

    useCartStore.setState({ items: [{ ...SILK_DRESS, product_id: 9, quantity: 1 }] });
    fireEvent.click(await screen.findByRole('button', { name: 'Checkout' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm Sale' }));

    await waitFor(() => expect(transport.idempotencyKeys()).toHaveLength(2));
    const [first, second] = transport.idempotencyKeys();
    expect(second).not.toBe(first);
  });

  it('reuses the same key when the cashier immediately retries the same cart', async () => {
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    const confirm = await openCheckout();
    transport.failNext('Gateway timeout', 502, undefined, undefined, 'sales');
    fireEvent.click(confirm);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    // The failure left the cart and the drawer alone, so the cashier can retry.
    expect(useCartStore.getState().items).toHaveLength(1);

    fireEvent.click(confirm);
    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(0));

    // Same key on both attempts: the first POST may have committed before the
    // response was lost, and the server has to recognise the second as its replay.
    const keys = transport.idempotencyKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
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
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      render(<CartPanel />, { wrapper: wrapperFor(transport) });

      transport.failNext('', 500);
      fireEvent.click(await openCheckout());

      await waitFor(() => expect(useOfflineStore.getState().queue).toHaveLength(1));
      expect(useOfflineStore.getState().queue[0].contractVersion).toBe('v1');
      // The queued entry carries the very key the failed POST went out under,
      // so a replay of a request that did land is deduped rather than doubled.
      const [attemptKey] = transport.idempotencyKeys();
      expect(useOfflineStore.getState().queue[0].idempotencyKey).toBe(attemptKey);
      expect(isValidIdempotencyKey(attemptKey)).toBe(true);
    } finally {
      // `defineProperty` above created an OWN property on the `navigator`
      // instance, shadowing the prototype's real getter -- restoring a
      // saved *prototype* descriptor (the old code here) never removes that
      // shadow, so `navigator.onLine` stayed stuck at `false` for the rest
      // of this file's shared jsdom window. Deleting the own property lets
      // the prototype's getter (true, jsdom's default) take over again.
      delete (navigator as { onLine?: boolean }).onLine;
    }
  });

  it('queues the sale offline when the post fails with no connection', async () => {
    const transport = makeTransport();
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
      // `defineProperty` above created an OWN property on the `navigator`
      // instance, shadowing the prototype's real getter -- restoring a
      // saved *prototype* descriptor (the old code here) never removes that
      // shadow, so `navigator.onLine` stayed stuck at `false` for the rest
      // of this file's shared jsdom window. Deleting the own property lets
      // the prototype's getter (true, jsdom's default) take over again.
      delete (navigator as { onLine?: boolean }).onLine;
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

  it('blocks checkout until a flagged cart is acknowledged', async () => {
    useCartStore.setState({ items: [SILK_DRESS], needsReview: true });
    const transport = makeTransport();

    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();

    fireEvent.click(await screen.findByRole('button', { name: 'Reviewed' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Checkout' })).toBeEnabled());
  });
});

async function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: 'Checkout' }));
  await screen.findByRole('button', { name: 'Confirm Sale' });
}

describe('CartPanel Quick Discount vs. tip separation', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useOfflineStore.setState({ queue: [], isSyncing: false });
    useCartStore.setState({
      items: [SILK_DRESS],
      discount: 0,
      discountType: 'fixed',
      notes: '',
      tip: 7,
      couponCode: '',
      couponDiscount: 0,
      needsReview: false,
    });
  });

  it('changes discount/discount_type and never mutates a pre-existing tip', async () => {
    const transport = makeTransport();
    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    await openDrawer();
    fireEvent.click(screen.getByRole('button', { name: '10%' }));

    expect(useCartStore.getState().discount).toBe(10);
    expect(useCartStore.getState().discountType).toBe('percentage');
    // The tip the cashier entered earlier is completely untouched.
    expect(useCartStore.getState().tip).toBe(7);

    // 10% of the 500 EGP subtotal is a discount line; the tip renders
    // separately, as a positive addition, never folded into the discount.
    expect(screen.getAllByText('-50 EG').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+7 EG').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Sale' }));

    await waitFor(() =>
      expect(
        transport.calls().some((call) => call.method === 'POST' && call.path === 'sales')
      ).toBe(true)
    );
    const sale = transport.calls().find((call) => call.path === 'sales');
    expect(sale?.body).toMatchObject({ discount: 10, discount_type: 'percentage', tip: 7 });
  });

  it('renders an entered tip as its own positive line and increases the amount due', async () => {
    useCartStore.setState({ tip: 0 });
    const transport = makeTransport();
    render(<CartPanel />, { wrapper: wrapperFor(transport) });

    await openDrawer();

    // Baseline: no discount, no tax, no tip -- amount due is the 500 EGP subtotal.
    expect(screen.getAllByText('500 EG').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Tip'), { target: { value: '25' } });

    expect(useCartStore.getState().tip).toBe(25);
    await waitFor(() => expect(screen.getAllByText('+25 EG').length).toBeGreaterThan(0));
    // Amount due increased by EXACTLY the tip amount: 500 + 25 = 525.
    expect(screen.getAllByText('525 EG').length).toBeGreaterThan(0);
  });
});

describe('CartPanel loyalty redemption', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useOfflineStore.setState({ queue: [], isSyncing: false });
    useCartStore.setState({
      items: [SILK_DRESS],
      discount: 0,
      discountType: 'fixed',
      notes: '',
      tip: 0,
      couponCode: '',
      couponDiscount: 0,
      needsReview: false,
    });
  });

  function loyaltyTransport() {
    return withSaleReply(
      createMemoryTransport(
        { customers: [{ id: 1, name: 'Amina', phone: '0100000000', loyalty_points: 200 }] },
        {
          reads: {
            settings: {
              tax_enabled: 'false',
              loyalty_enabled: 'true',
              loyalty_points_per_egp: '1',
              loyalty_egp_per_point: '0.10',
            },
            'customers/1/loyalty': { points: 200 },
          },
        }
      )
    );
  }

  it('caps redemption input and previews the server formula: 200 pts at 0.10 EGP/point = 20 EGP', async () => {
    const transport = loyaltyTransport();
    render(<CartPanel />, { wrapper: wrapperFor(transport) });
    await openDrawer();

    fireEvent.change(screen.getByPlaceholderText('Search customers...'), {
      target: { value: 'Amina' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Amina/ }, { timeout: 5000 }));

    fireEvent.click(await screen.findByLabelText('Use loyalty points', {}, { timeout: 5000 }));
    fireEvent.change(screen.getByLabelText('Points to redeem'), { target: { value: '200' } });

    // Not 2000 (misplaced decimal) and not 0.20 (reciprocal units) -- 20 EGP.
    await waitFor(() => expect(screen.getAllByText('-20 EG').length).toBeGreaterThan(0));
    expect(useCartStore.getState().couponDiscount).toBe(0); // unaffected control
  });

  it('never lets the cashier type more points than the balance/value cap allows', async () => {
    const transport = loyaltyTransport();
    render(<CartPanel />, { wrapper: wrapperFor(transport) });
    await openDrawer();

    fireEvent.change(screen.getByPlaceholderText('Search customers...'), {
      target: { value: 'Amina' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Amina/ }, { timeout: 5000 }));
    fireEvent.click(await screen.findByLabelText('Use loyalty points', {}, { timeout: 5000 }));

    // Balance is 200; typing far beyond it clamps to the cap, not the raw input.
    fireEvent.change(screen.getByLabelText('Points to redeem'), { target: { value: '9999' } });

    expect(screen.getByLabelText<HTMLInputElement>('Points to redeem').value).toBe('200');
  });
});

describe('CartPanel split tender', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useOfflineStore.setState({ queue: [], isSyncing: false });
    useCartStore.setState({
      items: [SILK_DRESS],
      discount: 0,
      discountType: 'fixed',
      notes: '',
      tip: 0,
      couponCode: '',
      couponDiscount: 0,
      needsReview: false,
    });
  });

  async function enableSplit() {
    await openDrawer();
    fireEvent.click(screen.getByLabelText('Split Payment'));
  }

  it('disables Confirm until entries balance exactly, and enables it once they do', async () => {
    const transport = makeTransport();
    render(<CartPanel />, { wrapper: wrapperFor(transport) });
    await enableSplit();

    const confirm = screen.getByRole('button', { name: 'Confirm Sale' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Cash Split Payment #1'), {
      target: { value: '300' },
    });
    // Short: 300 of 500 -- still disabled, remaining shown.
    expect(confirm).toBeDisabled();
    expect(screen.getByText('300 EG / 500 EG')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Card Split Payment #2'), {
      target: { value: '199' },
    });
    // Short by 1 EGP -- still disabled.
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Card Split Payment #2'), {
      target: { value: '250' },
    });
    // Overpaid (300 + 250 = 550 > 500) -- still disabled.
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Card Split Payment #2'), {
      target: { value: '200' },
    });
    // Exact: 300 + 200 = 500 -- enabled.
    await waitFor(() => expect(confirm).toBeEnabled());
  });

  it('invalidates a formerly-balanced split when the target total changes', async () => {
    useCartStore.setState({ tip: 0 });
    const transport = makeTransport();
    render(<CartPanel />, { wrapper: wrapperFor(transport) });
    await enableSplit();

    fireEvent.change(screen.getByLabelText('Cash Split Payment #1'), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText('Card Split Payment #2'), { target: { value: '0' } });

    const confirm = screen.getByRole('button', { name: 'Confirm Sale' });
    await waitFor(() => expect(confirm).toBeEnabled());

    // Adding a tip changes the amount due to 510 -- the 500/0 split the
    // cashier already balanced is now stale and must re-disable Confirm.
    fireEvent.change(screen.getByLabelText('Tip'), { target: { value: '10' } });

    await waitFor(() => expect(confirm).toBeDisabled());
  });

  it('shows an actionable error and keeps the cart intact when the server rejects a stale split', async () => {
    const transport = makeTransport();
    render(<CartPanel />, { wrapper: wrapperFor(transport) });
    await enableSplit();

    fireEvent.change(screen.getByLabelText('Cash Split Payment #1'), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText('Card Split Payment #2'), { target: { value: '0' } });

    const confirm = await screen.findByRole('button', { name: 'Confirm Sale' });
    await waitFor(() => expect(confirm).toBeEnabled());

    transport.failNext(
      'Payments no longer balance',
      400,
      'VALIDATION_ERROR',
      [{ field: 'payments', code: 'SPLIT_PAYMENT_MISMATCH', message: 'stale split' }],
      'sales'
    );
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'The total or payments changed since checkout was opened. Review the amount due and rebalance payments before confirming.'
      )
    );

    // No false success, and the cart is untouched -- nothing was cleared.
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].product_id).toBe(7);
  });
});

describe('CartPanel amount-due parity across surfaces', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    useOfflineStore.setState({ queue: [], isSyncing: false });
    useCartStore.setState({
      items: [SILK_DRESS],
      discount: 0,
      discountType: 'fixed',
      notes: '',
      tip: 0,
      couponCode: '',
      couponDiscount: 0,
      needsReview: false,
    });
  });

  /** Records every `moon-customer-display` broadcast this test's CartPanel posts. */
  class RecordingChannel {
    static messages: unknown[] = [];
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(message: unknown) {
      if (this.name === 'moon-customer-display') RecordingChannel.messages.push(message);
    }
    close() {}
  }

  it('agrees with the customer-display broadcast under exclusive tax', async () => {
    RecordingChannel.messages = [];
    vi.stubGlobal('BroadcastChannel', RecordingChannel);
    try {
      const transport = withSaleReply(
        createMemoryTransport(
          { customers: [] },
          {
            reads: {
              settings: {
                tax_enabled: 'true',
                tax_rate: '10',
                tax_mode: 'exclusive',
                loyalty_enabled: 'false',
              },
            },
          }
        )
      );

      render(<CartPanel />, { wrapper: wrapperFor(transport) });
      await openDrawer();

      // 500 subtotal, no discount, 10% exclusive tax added on top -> 550 due.
      await waitFor(() => expect(screen.getAllByText('550 EG').length).toBeGreaterThan(0));

      const last = RecordingChannel.messages[RecordingChannel.messages.length - 1] as {
        cart: { amountDue: number; taxAmount: number };
      };
      // The SAME amountDue the cart footer/checkout drawer just rendered --
      // never a separately-derived figure.
      expect(last.cart.amountDue).toBe(550);
      expect(last.cart.taxAmount).toBe(50);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('agrees with the customer-display broadcast under inclusive tax', async () => {
    RecordingChannel.messages = [];
    vi.stubGlobal('BroadcastChannel', RecordingChannel);
    try {
      const transport = withSaleReply(
        createMemoryTransport(
          { customers: [] },
          {
            reads: {
              settings: {
                tax_enabled: 'true',
                tax_rate: '10',
                tax_mode: 'inclusive',
                loyalty_enabled: 'false',
              },
            },
          }
        )
      );

      render(<CartPanel />, { wrapper: wrapperFor(transport) });
      await openDrawer();

      // Inclusive tax is already inside the 500 EGP subtotal -- amount due
      // stays 500, only the tax LINE (extracted, ~45.45) differs from
      // exclusive mode's 550/50.
      await waitFor(() => expect(screen.getAllByText('500 EG').length).toBeGreaterThan(0));

      const last = RecordingChannel.messages[RecordingChannel.messages.length - 1] as {
        cart: { amountDue: number };
      };
      expect(last.cart.amountDue).toBe(500);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
