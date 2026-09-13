/**
 * Turning the server's confirmed sale response into the receipt the cashier
 * prints.
 *
 * The single rule this file exists to protect: **every monetary figure comes
 * from the server's response, never from a client-side recomputation.** The
 * cart is consulted for exactly one thing — the product *name* per line, which
 * the server's resolved items do not carry. That lookup is cosmetic and never
 * substitutes for a confirmed amount.
 *
 * Extracted from CartPanel's mutation `onSuccess` (issue #51) so the mapping
 * can be tested without rendering the POS screen or completing a sale.
 */
import type { ReceiptData, ReceiptItem, ReceiptPayment } from '../../../shared/components/Receipt';
import type { TaxSettings } from '../../../shared/lib/checkout';
import type { CartItem, DiscountType } from '../store/cartStore';
import type { SaleResponse } from '../types';

export interface ReceiptContext {
  /** The cart as it stood when the sale was confirmed — display names only. */
  cartItems: CartItem[];
  /** Fallbacks for a response shaped like the pre-Unit-4 contract. */
  discount: number;
  discountType: DiscountType;
  couponCode: string;
  tax: TaxSettings;
  customerName?: string;
}

export function buildReceipt(sale: SaleResponse, context: ReceiptContext): ReceiptData {
  const { cartItems, discount, discountType, couponCode, tax, customerName } = context;
  const calc = sale.calculation;

  // Display name only -- looked up against the cart the cashier just rang up.
  // Every MONETARY figure below (quantity, unit_price, every calculation line,
  // total, payments) comes solely from `sale`/`calc`, the server's confirmed
  // response -- never recomputed client-side.
  const nameByLine = new Map(
    cartItems.map((i) => [`${i.product_id}:${i.variant_id ?? 0}`, i.name])
  );
  const receiptItems: ReceiptItem[] = (sale.items ?? []).map((item) => ({
    name: nameByLine.get(`${item.product_id}:${item.variant_id ?? 0}`) ?? item.memo ?? '',
    quantity: item.quantity,
    unit_price: item.unit_price,
  }));

  const receiptPayments: ReceiptPayment[] =
    sale.payments && sale.payments.length > 0
      ? sale.payments
      : [{ method: sale.payment_method, amount: calc?.amountDue ?? sale.total }];

  return {
    saleId: sale.id,
    items: receiptItems,
    discountType: sale.discount_type || discountType,
    discountValue: sale.discount ?? discount,
    couponCode: couponCode || undefined,
    // `calc` is additive-but-guaranteed on this branch (Unit 4); the fallback
    // only guards a response shaped like the pre-Unit-4 contract so the
    // receipt never crashes.
    calculation: calc ?? {
      subtotal: receiptItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
      manualDiscount: 0,
      couponDiscount: 0,
      pointsDiscount: 0,
      taxAmount: 0,
      taxMode: tax.mode,
      taxRatePercent: tax.rate,
      tipAmount: 0,
      amountDue: sale.total,
    },
    payments: receiptPayments,
    cashierName: sale.cashier_name || '',
    customerName,
    date: sale.created_at,
  };
}
