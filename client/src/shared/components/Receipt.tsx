import { formatCurrency, formatDateTime } from '../lib/utils';
import { useTranslation } from '../i18n/index';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
}

/**
 * Mirrors the authoritative `SaleCalculationSnapshot` the server persists and
 * returns from `POST /api/v1/sales` (`server/src/modules/pos/sales/types.ts`,
 * Unit 2/4). Every figure here is the CONFIRMED value for the sale that was
 * actually recorded -- the receipt renders these fields directly and never
 * recomputes them from the cart, so a settings/catalog/coupon change between
 * the cashier's preview and the confirmed response can never desync the two
 * (see docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md,
 * Unit 6, R6/R7).
 */
export interface ReceiptCalculation {
  subtotal: number;
  manualDiscount: number;
  couponDiscount: number;
  pointsDiscount: number;
  taxAmount: number;
  taxMode: 'inclusive' | 'exclusive';
  taxRatePercent: number;
  tipAmount: number;
  /** The one figure the customer actually paid: taxed amount plus tip, confirmed by the server. */
  amountDue: number;
}

export interface ReceiptData {
  saleId: number;
  items: ReceiptItem[];
  /** Manual-discount request shape, for the "(15%)" / "($10)" label only -- the money amount to subtract is `calculation.manualDiscount`. */
  discountType: string;
  discountValue: number;
  couponCode?: string;
  calculation: ReceiptCalculation;
  /** Split-tender lines when the sale used `payments`; a single-entry array otherwise. */
  payments: ReceiptPayment[];
  cashierName: string;
  customerName?: string;
  date: string;
}

interface ReceiptProps {
  data: ReceiptData;
}

export default function Receipt({ data }: ReceiptProps) {
  const { t } = useTranslation();
  const { calculation: calc } = data;

  const paymentLabel = (method: string) =>
    ({
      Cash: t('cart.cash'),
      Card: t('cart.card'),
      Other: t('cart.other'),
      'Gift Card': t('cart.giftCard'),
    })[method] || method;

  return (
    <div className="receipt-content w-[302px] mx-auto bg-white text-black p-4 font-mono text-xs leading-relaxed">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-base font-bold tracking-[0.2em] uppercase">MOON</h2>
        <p className="text-[10px] tracking-wider text-gray-500">{t('customerDisplay.tagline')}</p>
      </div>

      <div className="border-t border-dashed border-gray-300 my-3" />

      {/* Sale info */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('receipt.receiptNo')}</span>
          <span className="font-medium">#{data.saleId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('receipt.date')}</span>
          <span>{formatDateTime(data.date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('receipt.cashier')}</span>
          <span>{data.cashierName}</span>
        </div>
        {data.customerName && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('receipt.customer')}</span>
            <span>{data.customerName}</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-300 my-3" />

      {/* Items */}
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <div key={i}>
            <div className="font-medium truncate">{item.name}</div>
            <div className="flex justify-between text-gray-600 ps-2">
              <span>
                {item.quantity} x {formatCurrency(item.unit_price)}
              </span>
              <span>{formatCurrency(item.unit_price * item.quantity)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-gray-300 my-3" />

      {/* Totals -- every line below is a confirmed value from the server's
          calculation snapshot, not a client recomputation. */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>{t('cart.subtotal')}</span>
          <span>{formatCurrency(calc.subtotal)}</span>
        </div>
        {calc.manualDiscount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>
              {t('cart.discount')} (
              {data.discountType === 'percentage'
                ? `${data.discountValue}%`
                : formatCurrency(data.discountValue)}
              )
            </span>
            <span>-{formatCurrency(calc.manualDiscount)}</span>
          </div>
        )}
        {calc.couponDiscount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>
              {t('cart.coupon')}
              {data.couponCode ? ` (${data.couponCode})` : ''}
            </span>
            <span>-{formatCurrency(calc.couponDiscount)}</span>
          </div>
        )}
        {calc.pointsDiscount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>{t('loyalty.pointsDiscount')}</span>
            <span>-{formatCurrency(calc.pointsDiscount)}</span>
          </div>
        )}
        {calc.taxAmount > 0 && (
          <div className="flex justify-between">
            <span>
              {t('tax.vat')} {calc.taxRatePercent ? `(${calc.taxRatePercent}%)` : ''}
              {calc.taxMode === 'inclusive' ? ` ${t('tax.included')}` : ''}
            </span>
            <span>
              {calc.taxMode === 'exclusive' ? '+' : ''}
              {formatCurrency(calc.taxAmount)}
            </span>
          </div>
        )}
        {calc.tipAmount > 0 && (
          <div className="flex justify-between">
            <span>{t('cart.tip')}</span>
            <span>+{formatCurrency(calc.tipAmount)}</span>
          </div>
        )}
        <div className="border-t border-gray-300 my-1" />
        <div className="flex justify-between text-sm font-bold">
          <span>{t('cart.total')}</span>
          <span>{formatCurrency(calc.amountDue)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-300 my-3" />

      {/* Payment -- split-tender lines when the sale used `payments`, a single
          line otherwise. Amounts are the confirmed, validated entries. */}
      <div className="space-y-0.5">
        {data.payments.length > 1 ? (
          data.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-gray-600">
              <span>{paymentLabel(p.method)}</span>
              <span>{formatCurrency(p.amount)}</span>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-600">
            {t('receipt.paidWith')}: {paymentLabel(data.payments[0]?.method ?? '')}
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-gray-300 my-3" />

      {/* Footer */}
      <div className="text-center text-gray-500">
        <p>{t('receipt.thankYou')}</p>
      </div>
    </div>
  );
}
