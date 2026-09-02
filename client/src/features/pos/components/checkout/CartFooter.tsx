/**
 * The cart footer: the manual discount controls, the running breakdown, and
 * the button that opens the checkout drawer.
 *
 * Every figure it renders comes from the `totals` object it is handed — the
 * SAME one the drawer and the customer display use. It derives nothing.
 * Extracted from CartPanel (issue #51); markup unchanged.
 */
import { Button, Input, Divider } from '@heroui/react';
import { Tag } from 'lucide-react';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { TaxSettings, Totals, DiscountType } from '../../../../shared/lib/checkout';

const PERCENT_PRESETS = [5, 10, 15, 20];
const FIXED_PRESETS = [5, 10, 25, 50];

export default function CartFooter({
  discount,
  discountType,
  setDiscount,
  setDiscountType,
  tax,
  totals,
  checkoutDisabled,
  onCheckout,
}: {
  discount: number;
  discountType: DiscountType;
  setDiscount: (value: number) => void;
  setDiscountType: (type: DiscountType) => void;
  tax: TaxSettings;
  totals: Totals;
  checkoutDisabled: boolean;
  onCheckout: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="border-t border-border/50 p-4 space-y-3">
      {/* Discount */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Tag className="h-3 w-3" />
            {t('cart.discount')}
          </span>
          {discount > 0 && (
            <button
              onClick={() => setDiscount(0)}
              className="text-[10px] text-danger hover:underline transition-colors"
            >
              {t('cart.clearDiscount')}
            </button>
          )}
        </div>

        {/* Type toggle + input */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/30 border border-border rounded-lg overflow-hidden p-0.5">
            <button
              className={`px-2.5 py-1 text-xs font-data font-medium rounded-md transition-colors ${
                discountType === 'percentage'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => {
                // Converting an entered amount between units keeps the money
                // the same; the subtotal it converts against is the
                // authoritative one, never a second derivation of it.
                if (discountType === 'fixed' && discount > 0) {
                  const subtotal = totals.subtotal;
                  setDiscount(
                    subtotal > 0 ? Math.round((discount / subtotal) * 100 * 100) / 100 : 0
                  );
                }
                setDiscountType('percentage');
              }}
            >
              %
            </button>
            <button
              className={`px-2.5 py-1 text-xs font-data font-medium rounded-md transition-colors ${
                discountType === 'fixed'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => {
                if (discountType === 'percentage' && discount > 0) {
                  const subtotal = totals.subtotal;
                  setDiscount(Math.round(((subtotal * discount) / 100) * 100) / 100);
                }
                setDiscountType('fixed');
              }}
            >
              $
            </button>
          </div>
          <Input
            type="number"
            min="0"
            size="sm"
            variant="bordered"
            max={discountType === 'percentage' ? 100 : undefined}
            placeholder="0"
            value={discount ? String(discount) : ''}
            onValueChange={(val) => setDiscount(parseFloat(val) || 0)}
            className="flex-1 font-data"
          />
        </div>

        {/* Quick presets */}
        <div className="flex gap-1.5">
          {discountType === 'percentage'
            ? PERCENT_PRESETS.map((pct) => (
                <Button
                  key={pct}
                  size="sm"
                  variant={discount === pct ? 'solid' : 'bordered'}
                  color={discount === pct ? 'primary' : 'default'}
                  className="flex-1 h-7 min-w-0 px-1 text-[11px] font-data font-medium"
                  onClick={() => setDiscount(pct)}
                >
                  {pct}%
                </Button>
              ))
            : FIXED_PRESETS.map((amt) => (
                <Button
                  key={amt}
                  size="sm"
                  variant={discount === amt ? 'solid' : 'bordered'}
                  color={discount === amt ? 'primary' : 'default'}
                  className="flex-1 h-7 min-w-0 px-1 text-[11px] font-data font-medium"
                  onClick={() => setDiscount(amt)}
                >
                  ${amt}
                </Button>
              ))}
        </div>
      </div>

      <Divider />

      <div className="space-y-1.5">
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
              {t('tax.vat')}
              <span className="text-xs ms-1 opacity-70">({tax.rate}%)</span>
            </span>
            <span className="text-foreground">{formatCurrency(totals.taxAmount)}</span>
          </div>
        )}
        {totals.tip > 0 && (
          <div className="flex justify-between text-sm text-primary font-data">
            <span>{t('cart.tip')}</span>
            <span>+{formatCurrency(totals.tip)}</span>
          </div>
        )}
        {/* The SAME `amountDue` the checkout drawer and customer display
            use -- never a separately-derived figure (Unit 5 parity). */}
        <div className="flex justify-between text-lg font-semibold font-data text-foreground">
          <span>{t('cart.total')}</span>
          {/* E2E: the amount is a nameless sibling of its label, and "Total" renders
              simultaneously here, in the checkout drawer and on the receipt. */}
          <span data-testid="cart-total" className="text-primary font-bold">
            {formatCurrency(totals.amountDue)}
          </span>
        </div>
      </div>

      <Button
        color="primary"
        size="md"
        className="w-full font-semibold shadow-sm"
        onClick={onCheckout}
        isDisabled={checkoutDisabled}
      >
        {t('cart.checkout')}
      </Button>
    </div>
  );
}
