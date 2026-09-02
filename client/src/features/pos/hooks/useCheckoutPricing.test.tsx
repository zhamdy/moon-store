import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransportProvider } from '../../../shared/lib/transport/index';
import { createMemoryTransport, type MemoryTransport } from '../../../shared/lib/transport/memory';
import { useCartStore } from '../store/cartStore';
import { useCheckoutPricing } from './useCheckoutPricing';
import type { PaymentEntry } from '../types';

/**
 * The acceptance criterion for issue #51 is that checkout CALCULATION can be
 * tested without rendering the POS screen. Everything below drives the hook
 * directly — no CartPanel, no drawer, no POS page.
 */

const SILK_DRESS = {
  product_id: 7,
  name: 'Silk Dress',
  unit_price: 250,
  quantity: 2,
  stock: 5,
};

function transportWith(settings: Record<string, string>, loyaltyPoints = 200): MemoryTransport {
  return createMemoryTransport(
    { customers: [{ id: 1, name: 'Amina', phone: '0100000000' }] },
    { reads: { settings, 'customers/1/loyalty': { points: loyaltyPoints } } }
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

function renderPricing(
  transport: MemoryTransport,
  props: { customerId?: number | null; payments?: PaymentEntry[] } = {}
) {
  return renderHook(
    (p: { customerId?: number | null; payments?: PaymentEntry[] }) =>
      useCheckoutPricing({ customerId: p.customerId ?? null, payments: p.payments ?? [] }),
    { wrapper: wrapperFor(transport), initialProps: props }
  );
}

const NO_TAX_NO_LOYALTY = { tax_enabled: 'false', loyalty_enabled: 'false' };

describe('useCheckoutPricing', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [SILK_DRESS],
      discount: 0,
      discountType: 'fixed',
      notes: '',
      tip: 0,
      couponCode: '',
      couponDiscount: 0,
      needsReview: false,
      checkoutAttempt: null,
    });
  });

  it('derives the amount due from the cart alone when tax and loyalty are off', async () => {
    const { result } = renderPricing(transportWith(NO_TAX_NO_LOYALTY));

    await waitFor(() => expect(result.current.tax.enabled).toBe(false));
    expect(result.current.totals.subtotal).toBe(500);
    expect(result.current.totals.amountDue).toBe(500);
  });

  it('applies manual discount, coupon, tax and tip in the canonical order', async () => {
    useCartStore.setState({
      discount: 10,
      discountType: 'percentage',
      couponCode: 'SUMMER20',
      couponDiscount: 20,
      tip: 5,
    });
    const { result } = renderPricing(
      transportWith({ tax_enabled: 'true', tax_rate: '10', tax_mode: 'exclusive' })
    );

    await waitFor(() => expect(result.current.tax.enabled).toBe(true));
    // 500 - 50 (10%) - 20 (coupon) = 430 taxable; +43 tax; +5 tip = 478.
    expect(result.current.totals.discountAmount).toBe(50);
    expect(result.current.totals.couponDiscount).toBe(20);
    expect(result.current.totals.netOfDiscounts).toBe(430);
    expect(result.current.totals.taxAmount).toBe(43);
    expect(result.current.totals.tip).toBe(5);
    expect(result.current.totals.amountDue).toBe(478);
  });

  it('names, but does not add, tax that is already inside the price', async () => {
    const { result } = renderPricing(
      transportWith({ tax_enabled: 'true', tax_rate: '10', tax_mode: 'inclusive' })
    );

    await waitFor(() => expect(result.current.tax.mode).toBe('inclusive'));
    expect(result.current.totals.amountDue).toBe(500);
    expect(result.current.totals.taxAmount).toBeCloseTo(45.45, 2);
  });

  it('ignores a redemption request while loyalty is disabled', async () => {
    const { result } = renderPricing(transportWith(NO_TAX_NO_LOYALTY), { customerId: 1 });

    await waitFor(() => expect(result.current.loyalty.enabled).toBe(false));
    act(() => {
      result.current.setRedeemPoints(true);
      result.current.setPointsToRedeem(100);
    });

    expect(result.current.totals.pointsDiscount).toBe(0);
    expect(result.current.totals.amountDue).toBe(500);
    expect(result.current.maxPoints).toBe(0);
  });

  it('redeems at the direct EGP-per-point rate, before tax', async () => {
    const { result } = renderPricing(
      transportWith({
        tax_enabled: 'true',
        tax_rate: '10',
        tax_mode: 'exclusive',
        loyalty_enabled: 'true',
        loyalty_points_per_egp: '1',
        loyalty_egp_per_point: '0.10',
      }),
      { customerId: 1 }
    );

    await waitFor(() => expect(result.current.loyalty.customerPoints).toBe(200));
    act(() => {
      result.current.setRedeemPoints(true);
      result.current.setPointsToRedeem(200);
    });

    // 200 pts * 0.10 = 20 EGP off the TAXABLE base, not off the taxed total.
    await waitFor(() => expect(result.current.totals.pointsDiscount).toBe(20));
    expect(result.current.totals.netOfDiscounts).toBe(480);
    expect(result.current.totals.taxAmount).toBe(48);
    expect(result.current.totals.amountDue).toBe(528);
  });

  it('caps redemption at the balance and re-clamps when the sale shrinks', async () => {
    const { result } = renderPricing(
      transportWith(
        {
          loyalty_enabled: 'true',
          loyalty_points_per_egp: '1',
          loyalty_egp_per_point: '1',
          tax_enabled: 'false',
        },
        1000
      ),
      { customerId: 1 }
    );

    await waitFor(() => expect(result.current.loyalty.customerPoints).toBe(1000));
    // 1000 points at 1 EGP each would cover twice the 500 EGP sale, so the cap
    // is the sale's value, not the balance.
    await waitFor(() => expect(result.current.maxPoints).toBe(500));

    act(() => {
      result.current.setRedeemPoints(true);
      result.current.setPointsToRedeem(500);
    });
    await waitFor(() => expect(result.current.totals.pointsDiscount).toBe(500));

    // The cart shrinks under the cashier: the stale 500 points must not survive.
    act(() => {
      useCartStore.setState({ items: [{ ...SILK_DRESS, quantity: 1 }] });
    });

    await waitFor(() => expect(result.current.maxPoints).toBe(250));
    await waitFor(() => expect(result.current.pointsToRedeem).toBe(250));
    expect(result.current.totals.amountDue).toBe(0);
  });

  it('forgets the redemption on reset', async () => {
    const { result } = renderPricing(
      transportWith({
        loyalty_enabled: 'true',
        loyalty_points_per_egp: '1',
        loyalty_egp_per_point: '0.10',
        tax_enabled: 'false',
      }),
      { customerId: 1 }
    );

    await waitFor(() => expect(result.current.loyalty.customerPoints).toBe(200));
    act(() => {
      result.current.setRedeemPoints(true);
      result.current.setPointsToRedeem(100);
    });
    await waitFor(() => expect(result.current.totals.pointsDiscount).toBe(10));

    act(() => result.current.resetRedemption());

    expect(result.current.redeemPoints).toBe(false);
    expect(result.current.pointsToRedeem).toBe(0);
    expect(result.current.totals.pointsDiscount).toBe(0);
  });

  it('balances a split only when the tenders equal the amount due exactly', async () => {
    const { result, rerender } = renderPricing(transportWith(NO_TAX_NO_LOYALTY), {
      payments: [{ method: 'Cash', amount: 300 }],
    });

    await waitFor(() => expect(result.current.totals.amountDue).toBe(500));
    expect(result.current.split).toMatchObject({
      allocated: 300,
      remaining: 200,
      isBalanced: false,
      isOverpaid: false,
    });

    rerender({
      payments: [
        { method: 'Cash', amount: 300 },
        { method: 'Card', amount: 200 },
      ],
    });
    expect(result.current.split.isBalanced).toBe(true);

    rerender({
      payments: [
        { method: 'Cash', amount: 300 },
        { method: 'Card', amount: 250 },
      ],
    });
    expect(result.current.split).toMatchObject({ isBalanced: false, isOverpaid: true });
  });

  it('re-invalidates a balanced split when the amount due moves under it', async () => {
    const { result } = renderPricing(transportWith(NO_TAX_NO_LOYALTY), {
      payments: [{ method: 'Cash', amount: 500 }],
    });

    await waitFor(() => expect(result.current.split.isBalanced).toBe(true));

    act(() => useCartStore.setState({ tip: 10 }));

    await waitFor(() => expect(result.current.totals.amountDue).toBe(510));
    expect(result.current.split.isBalanced).toBe(false);
  });

  it('does not fetch a loyalty balance for a walk-in', async () => {
    const transport = transportWith({ loyalty_enabled: 'true', tax_enabled: 'false' });
    const { result } = renderPricing(transport, { customerId: null });

    await waitFor(() => expect(result.current.loyalty.enabled).toBe(true));
    expect(result.current.loyalty.customerPoints).toBe(0);
    expect(transport.calls().some((call) => call.path.includes('loyalty'))).toBe(false);
  });
});
