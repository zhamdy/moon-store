/**
 * The drawer's order summary: the lines being sold and the full breakdown.
 * Renders the same `totals` object the cart footer does — no figure here is
 * derived locally. Extracted from CartPanel (issue #51); markup unchanged.
 */
import { Divider } from '@heroui/react';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { TaxSettings, Totals, DiscountType } from '../../../../shared/lib/checkout';
import type { CartItem } from '../../store/cartStore';

export default function CheckoutSummary({
  items,
  discount,
  discountType,
  couponCode,
  tax,
  totals,
}: {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  couponCode: string;
  tax: TaxSettings;
  totals: Totals;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('cart.orderSummary')}
      </h3>
      {items.map((item) => (
        <div key={item.product_id} className="flex justify-between text-sm font-data">
          <span className="text-foreground">
            {item.name} x{item.quantity}
          </span>
          <span className="text-foreground font-medium">
            {formatCurrency(item.unit_price * item.quantity)}
          </span>
        </div>
      ))}
      <Divider className="my-2" />
      <div className="flex justify-between text-sm text-muted-foreground font-data">
        <span>{t('cart.subtotal')}</span>
        <span className="text-foreground">{formatCurrency(totals.subtotal)}</span>
      </div>
      {totals.discountAmount > 0 && (
        <div className="flex justify-between text-sm text-danger font-data">
          <span>
            {t('cart.discount')}
            <span className="text-xs ms-1 opacity-70">
              ({discountType === 'percentage' ? `${discount}%` : formatCurrency(discount)})
            </span>
          </span>
          <span>-{formatCurrency(totals.discountAmount)}</span>
        </div>
      )}
      {tax.enabled && (
        <div className="flex justify-between text-sm text-muted-foreground font-data">
          <span>
            {t('tax.vat')} ({tax.rate}%)
          </span>
          <span className="text-foreground">{formatCurrency(totals.taxAmount)}</span>
        </div>
      )}
      {totals.couponDiscount > 0 && (
        <div className="flex justify-between text-sm text-primary font-data">
          <span>
            {t('cart.coupon')} ({couponCode})
          </span>
          <span>-{formatCurrency(totals.couponDiscount)}</span>
        </div>
      )}
      {totals.pointsDiscount > 0 && (
        <div className="flex justify-between text-sm text-primary font-data">
          <span>{t('loyalty.pointsDiscount')}</span>
          <span>-{formatCurrency(totals.pointsDiscount)}</span>
        </div>
      )}
      {totals.tip > 0 && (
        <div className="flex justify-between text-sm text-primary font-data">
          <span>{t('cart.tip')}</span>
          <span>+{formatCurrency(totals.tip)}</span>
        </div>
      )}
      <div className="flex justify-between text-base font-bold font-data text-foreground">
        <span>{t('cart.total')}</span>
        {/* E2E: see cart-total — same nameless sibling, same label collision. */}
        <span data-testid="checkout-total" className="text-primary">
          {formatCurrency(totals.amountDue)}
        </span>
      </div>
    </div>
  );
}
