/**
 * Mirrors the cart to the customer-facing display.
 *
 * The projection it posts is the SAME `totals` object the cart footer and the
 * checkout drawer render — never a separately-derived one — so the customer's
 * screen always agrees to the cent with the cashier's (Unit 5). This hook owns
 * the channel entirely; POS.tsx deliberately posts nothing of its own.
 *
 * Extracted from CartPanel (issue #51); behaviour unchanged.
 */
import { useEffect } from 'react';
import type { Totals, TaxSettings, DiscountType } from '../../../shared/lib/checkout';
import type { CartItem } from '../store/cartStore';

export const CUSTOMER_DISPLAY_CHANNEL = 'moon-customer-display';

export function useCustomerDisplayBroadcast(input: {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  couponCode: string;
  tax: TaxSettings;
  totals: Totals;
}): void {
  const { items, discount, discountType, couponCode, tax, totals } = input;

  useEffect(() => {
    const channel = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    if (items.length > 0) {
      channel.postMessage({
        type: 'cart-update',
        cart: {
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
            memo: i.memo,
          })),
          subtotal: totals.subtotal,
          discount,
          discountType,
          discountAmount: totals.discountAmount,
          couponCode: couponCode || undefined,
          couponDiscount: totals.couponDiscount,
          taxEnabled: tax.enabled,
          taxRate: tax.rate,
          taxAmount: totals.taxAmount,
          pointsDiscount: totals.pointsDiscount,
          tip: totals.tip,
          amountDue: totals.amountDue,
        },
      });
    } else {
      channel.postMessage({ type: 'cart-clear' });
    }
    channel.close();
  }, [items, discount, discountType, couponCode, tax, totals]);
}
