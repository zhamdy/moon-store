import { formatCurrency, formatDateTime } from '../lib/utils';
import { useTranslation } from '../i18n';

export interface ReceiptData {
  saleId: number;
  items: { name: string; quantity: number; unit_price: number }[];
  subtotal: number;
  discount: number;
  discountType: string;
  total: number;
  taxAmount?: number;
  taxRate?: number;
  paymentMethod: string;
  cashierName: string;
  customerName?: string;
  date: string;
}

interface ReceiptProps {
  data: ReceiptData;
}

export default function Receipt({ data }: ReceiptProps) {
  const { t } = useTranslation();

  const discountAmount =
    data.discountType === 'percentage' ? (data.subtotal * data.discount) / 100 : data.discount;

  return (
    <div className="receipt-content w-[302px] mx-auto bg-white text-black p-4 font-mono text-xs leading-relaxed">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-base font-bold tracking-[0.2em] uppercase">MOON</h2>
        <p className="text-[10px] tracking-wider text-gray-500">Fashion & Style</p>
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

      {/* Totals */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>{t('cart.subtotal')}</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>
              {t('cart.discount')} (
              {data.discountType === 'percentage'
                ? `${data.discount}%`
                : formatCurrency(data.discount)}
              )
            </span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        {data.taxAmount && data.taxAmount > 0 ? (
          <div className="flex justify-between">
            <span>
              {t('tax.vat')} {data.taxRate ? `(${data.taxRate}%)` : ''}
            </span>
            <span>{formatCurrency(data.taxAmount)}</span>
          </div>
        ) : null}
        <div className="border-t border-gray-300 my-1" />
        <div className="flex justify-between text-sm font-bold">
          <span>{t('cart.total')}</span>
          <span>{formatCurrency(data.total)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-300 my-3" />

      {/* Payment */}
      <div className="text-center text-gray-600">
        {t('receipt.paidWith')}: {data.paymentMethod}
      </div>

      <div className="border-t border-dashed border-gray-300 my-3" />

      {/* Footer */}
      <div className="text-center text-gray-500">
        <p>{t('receipt.thankYou')}</p>
      </div>
    </div>
  );
}
