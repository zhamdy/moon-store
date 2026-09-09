import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Checkbox,
  Select,
  SelectItem,
} from '@heroui/react';
import { formatCurrency } from '../../../shared/lib/utils';
import { resource } from '../../../shared/lib/resource';
import { useTranslation } from '../../../shared/i18n/index';
import type { SaleItem, SaleRefund } from '../types';

/** Only the refund sub-action is reached from here, so no row shape surfaces. */
const sales = resource<{ id: number }>('sales');

/**
 * The key a sale line is identified by, matching the server's own composite key: two
 * variants of one product are distinct lines, and a plain line normalizes to the empty
 * variant. `product_id` alone would collapse them onto one row and let the cashier
 * request a refund the server has to reject (#120, #121).
 */
const lineKey = (item: { product_id: number; variant_id?: number | null }): string =>
  `${item.product_id}:${item.variant_id ?? ''}`;

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: number | null;
  saleTotal: number;
  refundedAmount: number;
  items: SaleItem[];
  /** Prior refunds against this sale; each line's remaining quantity is derived from them. */
  refunds?: SaleRefund[];
}

type RefundReason = 'Customer Return' | 'Cashier Error' | 'Defective' | 'Other';

export default function RefundDialog({
  open,
  onOpenChange,
  saleId,
  saleTotal,
  refundedAmount,
  items,
  refunds = [],
}: RefundDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedItems, setSelectedItems] = useState<
    Record<string, { selected: boolean; quantity: number }>
  >({});
  const [reason, setReason] = useState<RefundReason>('Customer Return');
  const [restock, setRestock] = useState(true);

  const resetForm = () => {
    setSelectedItems({});
    setReason('Customer Return');
    setRestock(true);
  };

  /** How much of each line prior refunds have already taken, keyed the server's way. */
  const alreadyRefunded = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const refund of refunds) {
      for (const item of refund.items ?? []) {
        counts[lineKey(item)] = (counts[lineKey(item)] ?? 0) + item.quantity;
      }
    }
    return counts;
  }, [refunds]);

  /** Sold minus already refunded: the most this line can still be refunded for. */
  const remainingFor = (item: SaleItem): number =>
    Math.max(0, item.quantity - (alreadyRefunded[lineKey(item)] ?? 0));

  const refundAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const sel = selectedItems[lineKey(item)];
      if (sel?.selected && sel.quantity > 0) {
        return sum + item.unit_price * sel.quantity;
      }
      return sum;
    }, 0);
  }, [selectedItems, items]);

  const maxRefundable = saleTotal - refundedAmount;

  const refunder = sales.useAction('refund', {
    message: t('sales.refundSuccess'),
    fallbackMessage: t('sales.refundFailed'),
    onDone: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-detail'] });
      onOpenChange(false);
      resetForm();
    },
  });

  const handleSubmit = () => {
    if (saleId === null) return;

    const refundItems = items
      .filter((item) => {
        const sel = selectedItems[lineKey(item)];
        return sel?.selected && sel.quantity > 0;
      })
      .map((item) => ({
        product_id: item.product_id,
        // Sent only for a variant line, so a plain line's payload is unchanged.
        ...(item.variant_id ? { variant_id: item.variant_id } : {}),
        quantity: selectedItems[lineKey(item)].quantity,
        unit_price: item.unit_price,
      }));

    if (refundItems.length === 0) return;

    refunder.run({ id: saleId, body: { items: refundItems, reason, restock } });
  };

  const toggleItem = (key: string, maxQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[key];
      if (current?.selected) {
        return { ...prev, [key]: { selected: false, quantity: 0 } };
      }
      return { ...prev, [key]: { selected: true, quantity: maxQty } };
    });
  };

  const updateQuantity = (key: string, qty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [key]: { selected: qty > 0, quantity: qty },
    }));
  };

  const hasSelection = Object.values(selectedItems).some((s) => s.selected && s.quantity > 0);

  return (
    <Modal
      isOpen={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
      backdrop="blur"
      placement="center"
      size="lg"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-border/50">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold">
                    {t('sales.refundSale', { id: saleId ?? '' })}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('sales.refundDesc')}
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4">
              {/* Item selection */}
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
                  {t('sales.selectItems')}
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {items.map((item) => {
                    const key = lineKey(item);
                    const sel = selectedItems[key];
                    const remaining = remainingFor(item);
                    const exhausted = remaining === 0;
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/10 transition-colors ${
                          exhausted ? 'opacity-60' : 'hover:border-primary/40'
                        }`}
                      >
                        <Checkbox
                          isSelected={sel?.selected || false}
                          isDisabled={exhausted}
                          onValueChange={() => toggleItem(key, remaining)}
                          size="sm"
                          aria-label={`Select ${item.product_name}${
                            item.variant_sku ? ` (${item.variant_sku})` : ''
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.product_name}
                            {item.variant_sku && (
                              <span className="text-muted-foreground font-normal">
                                {' '}
                                · {item.variant_sku}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground font-data">
                            {formatCurrency(item.unit_price)} x {item.quantity}
                            {remaining < item.quantity && !exhausted && (
                              <span>
                                {' · '}
                                {t('sales.refundRemaining', { remaining, sold: item.quantity })}
                              </span>
                            )}
                          </p>
                        </div>
                        {/* Stated in words, not only by the dimmed row: a disabled control
                            that does not say why reads as a broken one. */}
                        {exhausted && (
                          <span className="text-xs text-muted-foreground">
                            {t('sales.alreadyFullyRefunded')}
                          </span>
                        )}
                        {!exhausted && sel?.selected && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground" id={`qty-label-${key}`}>
                              {t('sales.qtyToRefund')}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={remaining}
                              value={sel.quantity}
                              aria-labelledby={`qty-label-${key}`}
                              onChange={(e) =>
                                updateQuantity(
                                  key,
                                  Math.min(remaining, Math.max(1, Number(e.target.value)))
                                )
                              }
                              className="w-14 h-8 text-center text-sm border border-border rounded-lg bg-card text-foreground font-data focus:outline-none focus:border-primary"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <Select
                  label={t('sales.refundReason')}
                  size="sm"
                  variant="bordered"
                  selectedKeys={[reason]}
                  onChange={(e) => {
                    if (e.target.value) setReason(e.target.value as RefundReason);
                  }}
                >
                  <SelectItem
                    key="Customer Return"
                    textValue={t('sales.refundReasonCustomerReturn')}
                  >
                    {t('sales.refundReasonCustomerReturn')}
                  </SelectItem>
                  <SelectItem key="Cashier Error" textValue={t('sales.refundReasonCashierError')}>
                    {t('sales.refundReasonCashierError')}
                  </SelectItem>
                  <SelectItem key="Defective" textValue={t('sales.refundReasonDefective')}>
                    {t('sales.refundReasonDefective')}
                  </SelectItem>
                  <SelectItem key="Other" textValue={t('sales.refundReasonOther')}>
                    {t('sales.refundReasonOther')}
                  </SelectItem>
                </Select>
              </div>

              {/* Restock toggle */}
              <div className="flex items-center gap-3">
                <Checkbox id="restock" isSelected={restock} onValueChange={setRestock} size="sm">
                  <div>
                    <span className="text-sm font-medium text-foreground block">
                      {t('sales.refundRestock')}
                    </span>
                    <span className="text-xs text-muted-foreground block font-normal">
                      {t('sales.refundRestockDesc')}
                    </span>
                  </div>
                </Checkbox>
              </div>

              {/* Refund amount summary */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-muted/20 border border-border">
                <span className="text-sm text-muted-foreground">{t('sales.refundAmount')}</span>
                <span className="text-lg font-bold text-primary font-data">
                  {formatCurrency(refundAmount)}
                </span>
              </div>

              {refundAmount > maxRefundable && (
                <p className="text-xs text-danger">
                  Refund amount exceeds remaining refundable amount ({formatCurrency(maxRefundable)}
                  )
                </p>
              )}

              {/* Submit */}
              <Button
                color="primary"
                onPress={handleSubmit}
                isDisabled={
                  !hasSelection ||
                  refunder.isRunning ||
                  refundAmount > maxRefundable ||
                  refundAmount <= 0
                }
                isLoading={refunder.isRunning}
                className="w-full font-semibold"
              >
                {refunder.isRunning ? t('sales.refundProcessing') : t('sales.refundSubmit')}
              </Button>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
