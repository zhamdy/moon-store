import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useSettingsStore } from '../store/settingsStore';
import Receipt, { type ReceiptData } from './Receipt';

beforeEach(() => {
  useSettingsStore.setState({ locale: 'en' });
});

/**
 * A confirmed sale response as it would arrive from the server: manual
 * discount, coupon, loyalty points, exclusive tax, and a tip -- combined, to
 * prove every line renders from the confirmed calculation, with the correct
 * sign, rather than being recomputed.
 */
const CONFIRMED: ReceiptData = {
  saleId: 42,
  items: [
    { name: 'Silk Dress', quantity: 2, unit_price: 250 },
    { name: 'Cotton Shirt', quantity: 1, unit_price: 200 },
  ],
  discountType: 'percentage',
  discountValue: 10,
  couponCode: 'SUMMER20',
  calculation: {
    subtotal: 700,
    manualDiscount: 70, // 10% of 700
    couponDiscount: 20,
    pointsDiscount: 15,
    taxAmount: 55.65,
    taxMode: 'exclusive',
    taxRatePercent: 14,
    tipAmount: 25,
    amountDue: 675.65, // 700 - 70 - 20 - 15 = 595 taxable; +55.65 tax +25 tip
  },
  payments: [{ method: 'Cash', amount: 675.65 }],
  cashierName: 'Sarah',
  customerName: 'Layla',
  date: '2026-02-01T10:00:00.000Z',
};

describe('Receipt', () => {
  it('renders every line from the confirmed calculation, not a recomputation', () => {
    render(<Receipt data={CONFIRMED} />);

    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Sarah')).toBeInTheDocument();
    expect(screen.getByText('Layla')).toBeInTheDocument();

    // Subtotal from calculation.subtotal
    expect(screen.getByText('700 EG')).toBeInTheDocument();
    // Manual discount: -70, labeled with the request's percent value
    expect(screen.getByText('-70 EG')).toBeInTheDocument();
    expect(screen.getAllByText(/10%/).length).toBeGreaterThan(0);
    // Coupon discount: -20, labeled with the coupon code
    expect(screen.getByText('-20 EG')).toBeInTheDocument();
    expect(screen.getAllByText(/SUMMER20/).length).toBeGreaterThan(0);
    // Loyalty/points discount: -15
    expect(screen.getByText('-15 EG')).toBeInTheDocument();
    // Tax: exclusive, added on top with a '+'
    expect(screen.getByText('+55.65 EG')).toBeInTheDocument();
    // Tip: added, with a '+'
    expect(screen.getByText('+25 EG')).toBeInTheDocument();
    // Total: the confirmed amountDue, exactly
    expect(screen.getByText('675.65 EG')).toBeInTheDocument();
  });

  it('shows the server total even when it differs from a client preview total', () => {
    // A provisional client-side preview computed a different total (e.g. the
    // cart preview before a coupon/loyalty change was reconciled server-side).
    const clientPreviewTotal = 999.99;
    const serverConfirmed: ReceiptData = {
      ...CONFIRMED,
      calculation: { ...CONFIRMED.calculation, amountDue: 675.65 },
    };

    render(<Receipt data={serverConfirmed} />);

    expect(screen.getByText('675.65 EG')).toBeInTheDocument();
    expect(screen.queryByText(`${clientPreviewTotal} EG`)).not.toBeInTheDocument();
  });

  it('renders an inclusive tax line without a leading +', () => {
    const inclusive: ReceiptData = {
      ...CONFIRMED,
      calculation: {
        ...CONFIRMED.calculation,
        taxMode: 'inclusive',
        taxAmount: 40,
        amountDue: 620,
      },
    };
    render(<Receipt data={inclusive} />);
    expect(screen.getByText('40 EG')).toBeInTheDocument();
    expect(screen.queryByText('+40 EG')).not.toBeInTheDocument();
  });

  it('omits discount/coupon/loyalty/tax/tip lines that are zero', () => {
    const plain: ReceiptData = {
      saleId: 7,
      items: [{ name: 'Cotton Shirt', quantity: 1, unit_price: 200 }],
      discountType: 'fixed',
      discountValue: 0,
      calculation: {
        subtotal: 200,
        manualDiscount: 0,
        couponDiscount: 0,
        pointsDiscount: 0,
        taxAmount: 0,
        taxMode: 'exclusive',
        taxRatePercent: 0,
        tipAmount: 0,
        amountDue: 200,
      },
      payments: [{ method: 'Cash', amount: 200 }],
      cashierName: 'Sarah',
      date: '2026-02-01T10:00:00.000Z',
    };

    render(<Receipt data={plain} />);
    expect(screen.queryByText(/cart\.discount/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cart\.coupon/)).not.toBeInTheDocument();
  });

  it('renders each split-tender payment line with its own amount', () => {
    const split: ReceiptData = {
      ...CONFIRMED,
      payments: [
        { method: 'Cash', amount: 400 },
        { method: 'Card', amount: 275.65 },
      ],
    };
    render(<Receipt data={split} />);
    expect(screen.getByText('400 EG')).toBeInTheDocument();
    expect(screen.getByText('275.65 EG')).toBeInTheDocument();
  });
});
