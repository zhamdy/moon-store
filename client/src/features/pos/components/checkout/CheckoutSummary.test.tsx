import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useSettingsStore } from '../../../../shared/store/settingsStore';
import type { CartItem } from '../../store/cartStore';
import CheckoutSummary from './CheckoutSummary';

/**
 * REGRESSION (PR #76 review, finding 15): these rows used to be keyed on
 * `item.product_id` alone, while the cart itself keys a line by
 * (product_id, variant_id). A cart holding two variants of one product
 * therefore emitted duplicate React keys, and React may then reconcile a row
 * against the wrong element and show a stale quantity or price.
 *
 * Which assertion below actually catches it, verified by reverting the fix:
 * only "gives each variant a distinct React key". The two content assertions
 * pass either way -- with duplicate keys React still recovers for this shape
 * of update, and whether it does depends on internals no test should depend
 * on. They are kept as documentation of what the section must show, not as
 * the guard. Do not delete the key assertion believing them to cover it.
 */

const SILK_DRESS_SMALL: CartItem = {
  product_id: 7,
  variant_id: 3,
  name: 'Silk Dress',
  unit_price: 250,
  quantity: 2,
  stock: 5,
};

const SILK_DRESS_LARGE: CartItem = {
  product_id: 7,
  variant_id: 9,
  name: 'Silk Dress',
  unit_price: 300,
  quantity: 1,
  stock: 5,
};

/** A breakdown is required but irrelevant here — the rows above it are what is under test. */
function totalsFor(items: CartItem[]) {
  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  return {
    subtotal,
    discountAmount: 0,
    couponDiscount: 0,
    netOfDiscounts: subtotal,
    taxAmount: 0,
    totalWithTax: subtotal,
    pointsDiscount: 0,
    tip: 0,
    amountDue: subtotal,
    earnedPoints: 0,
  };
}

function renderSummary(items: CartItem[]) {
  return render(
    <CheckoutSummary
      items={items}
      discount={0}
      discountType="fixed"
      couponCode=""
      tax={{ enabled: false, rate: 0, mode: 'exclusive' }}
      totals={totalsFor(items)}
    />
  );
}

describe('CheckoutSummary line keys', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  // Documentation of intent -- passes with or without the fix (see file header).
  it('renders two variants of the same product as two lines, each with its own values', () => {
    renderSummary([SILK_DRESS_SMALL, SILK_DRESS_LARGE]);

    expect(screen.getByText('Silk Dress x2')).toBeInTheDocument();
    expect(screen.getByText('Silk Dress x1')).toBeInTheDocument();
    // 2 x 250 and 1 x 300 -- neither line borrows the other's figure.
    expect(screen.getByText('500 EG')).toBeInTheDocument();
    expect(screen.getByText('300 EG')).toBeInTheDocument();
  });

  it('gives each variant a distinct React key', () => {
    renderSummary([SILK_DRESS_SMALL, SILK_DRESS_LARGE]);

    // THE guard for finding 15. React warns "Encountered two children with the
    // same key" on a duplicate, which is the defect itself surfacing rather
    // than a cosmetic complaint -- and it is the only assertion here that goes
    // red if the key regresses to a bare `product_id`.
    const warnings = (consoleError.mock.calls as unknown[][]).map((args) => String(args[0]));
    expect(warnings.filter((message) => message.includes('same key'))).toEqual([]);
  });

  // Also documentation of intent -- see the file header on why this survives
  // the bug. It pins the rendered behaviour, not the keying.
  it('updates the right line when one variant changes, instead of reconciling against its sibling', () => {
    const items = [SILK_DRESS_SMALL, SILK_DRESS_LARGE];
    const { rerender } = renderSummary(items);

    const updated = [SILK_DRESS_SMALL, { ...SILK_DRESS_LARGE, quantity: 4 }];
    rerender(
      <CheckoutSummary
        items={updated}
        discount={0}
        discountType="fixed"
        couponCode=""
        tax={{ enabled: false, rate: 0, mode: 'exclusive' }}
        totals={totalsFor(updated)}
      />
    );

    // The changed variant, and only it, moved: 4 x 300 = 1200; the other line
    // still reads 2 x 250 = 500.
    expect(screen.getByText('Silk Dress x4')).toBeInTheDocument();
    expect(screen.getByText('1,200 EG')).toBeInTheDocument();
    expect(screen.getByText('Silk Dress x2')).toBeInTheDocument();
    expect(screen.getByText('500 EG')).toBeInTheDocument();
    expect(screen.queryByText('Silk Dress x1')).not.toBeInTheDocument();
  });

  it('still renders a plain single-variant cart', () => {
    renderSummary([{ ...SILK_DRESS_SMALL, variant_id: null }]);

    expect(screen.getByText('Silk Dress x2')).toBeInTheDocument();
    expect(screen.getAllByText('500 EG').length).toBeGreaterThan(0);
  });
});
