/**
 * How the sale is tendered: one method, or a split across several.
 *
 * The running "allocated / due" figure and whether the split balances are both
 * decided by `useCheckoutPricing`'s `split`; this component never compares
 * amounts itself. Extracted from CartPanel (issue #51); markup unchanged.
 */
import { Button, Input, RadioGroup, Radio } from '@heroui/react';
import { Plus, X } from 'lucide-react';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { Allocation, Totals } from '../../../../shared/lib/checkout';
import type { PaymentEntry, PaymentMethod } from '../../types';

export default function PaymentSection({
  paymentMethod,
  setPaymentMethod,
  splitPayment,
  setSplitPayment,
  payments,
  setPayments,
  split,
  totals,
}: {
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  splitPayment: boolean;
  setSplitPayment: (on: boolean) => void;
  payments: PaymentEntry[];
  setPayments: (payments: PaymentEntry[]) => void;
  split: Allocation;
  totals: Totals;
}): React.JSX.Element {
  const { t } = useTranslation();

  const paymentLabels: Record<PaymentMethod | 'Gift Card', string> = {
    Cash: t('cart.cash'),
    Card: t('cart.card'),
    Other: t('cart.other'),
    'Gift Card': t('cart.giftCard'),
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('cart.paymentMethod')}
        </h3>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={splitPayment}
            onChange={(e) => {
              setSplitPayment(e.target.checked);
              if (e.target.checked) {
                setPayments([
                  { method: 'Cash', amount: 0 },
                  { method: 'Card', amount: 0 },
                ]);
              } else {
                setPayments([]);
              }
            }}
            className="accent-primary h-3.5 w-3.5 rounded"
          />
          {t('cart.splitPayment')}
        </label>
      </div>

      {!splitPayment ? (
        <RadioGroup
          value={paymentMethod}
          onValueChange={(val: string) => setPaymentMethod(val as PaymentMethod)}
          className="space-y-1.5"
        >
          {(['Cash', 'Card', 'Other'] as const).map((method) => (
            <Radio
              key={method}
              value={method}
              classNames={{
                base: `flex items-center gap-3 px-3 py-2 rounded-xl border transition-colors cursor-pointer max-w-full m-0 ${
                  paymentMethod === method
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`,
                label: 'text-sm font-medium text-foreground cursor-pointer',
              }}
            >
              {paymentLabels[method]}
            </Radio>
          ))}
        </RadioGroup>
      ) : (
        <div className="space-y-2">
          {payments.map((p, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                className="h-8 rounded-lg border border-border bg-card text-foreground px-2 text-xs"
                value={p.method}
                onChange={(e) => {
                  const next = [...payments];
                  next[idx] = { ...next[idx], method: e.target.value as PaymentMethod };
                  setPayments(next);
                }}
              >
                <option value="Cash">{t('cart.cash')}</option>
                <option value="Card">{t('cart.card')}</option>
                <option value="Gift Card">{t('cart.giftCard')}</option>
                <option value="Other">{t('cart.other')}</option>
              </select>
              <Input
                type="number"
                min="0"
                step="0.01"
                size="sm"
                variant="bordered"
                aria-label={`${paymentLabels[p.method] ?? p.method} ${t('cart.splitPayment')} #${idx + 1}`}
                value={p.amount ? String(p.amount) : ''}
                onValueChange={(val) => {
                  const next = [...payments];
                  next[idx] = { ...next[idx], amount: parseFloat(val) || 0 };
                  setPayments(next);
                }}
                className="flex-1 font-data"
              />
              {payments.length > 2 && (
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  className="h-7 w-7"
                  onPress={() => setPayments(payments.filter((_, i) => i !== idx))}
                  aria-label="Remove payment split"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-1">
            <Button
              variant="light"
              size="sm"
              startContent={<Plus className="h-3 w-3" />}
              onPress={() => setPayments([...payments, { method: 'Cash', amount: 0 }])}
            >
              {t('cart.addPayment')}
            </Button>
            <span
              className={`font-data font-semibold ${split.isBalanced ? 'text-success' : 'text-danger'}`}
            >
              {formatCurrency(split.allocated)} / {formatCurrency(totals.amountDue)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
