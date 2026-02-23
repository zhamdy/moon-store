import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { formatCurrency } from '../lib/utils';
import api from '../services/api';
import { useTranslation } from '../i18n';

interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: number | null;
  saleTotal: number;
  refundedAmount: number;
  items: SaleItem[];
}

type RefundReason = 'Customer Return' | 'Cashier Error' | 'Defective' | 'Other';

export default function RefundDialog({
  open,
  onOpenChange,
  saleId,
  saleTotal,
  refundedAmount,
  items,
}: RefundDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedItems, setSelectedItems] = useState<
    Record<number, { selected: boolean; quantity: number }>
  >({});
  const [reason, setReason] = useState<RefundReason>('Customer Return');
  const [restock, setRestock] = useState(true);

  const resetForm = () => {
    setSelectedItems({});
    setReason('Customer Return');
    setRestock(true);
  };

  const refundAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const sel = selectedItems[item.product_id];
      if (sel?.selected && sel.quantity > 0) {
        return sum + item.unit_price * sel.quantity;
      }
      return sum;
    }, 0);
  }, [selectedItems, items]);

  const maxRefundable = saleTotal - refundedAmount;

  const mutation = useMutation({
    mutationFn: (data: {
      items: { product_id: number; quantity: number; unit_price: number }[];
      reason: string;
      restock: boolean;
    }) => api.post(`/api/sales/${saleId}/refund`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success(t('sales.refundSuccess'));
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale-detail'] });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast.error(t('sales.refundFailed'));
    },
  });

  const handleSubmit = () => {
    const refundItems = items
      .filter((item) => {
        const sel = selectedItems[item.product_id];
        return sel?.selected && sel.quantity > 0;
      })
      .map((item) => ({
        product_id: item.product_id,
        quantity: selectedItems[item.product_id].quantity,
        unit_price: item.unit_price,
      }));

    if (refundItems.length === 0) return;

    mutation.mutate({ items: refundItems, reason, restock });
  };

  const toggleItem = (productId: number, maxQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[productId];
      if (current?.selected) {
        return { ...prev, [productId]: { selected: false, quantity: 0 } };
      }
      return { ...prev, [productId]: { selected: true, quantity: maxQty } };
    });
  };

  const updateQuantity = (productId: number, qty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [productId]: { selected: qty > 0, quantity: qty },
    }));
  };

  const hasSelection = Object.values(selectedItems).some((s) => s.selected && s.quantity > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wider">
            <RotateCcw className="h-5 w-5 text-gold" />
            {t('sales.refundSale', { id: saleId })}
          </DialogTitle>
          <DialogDescription>{t('sales.refundDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item selection */}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted font-body mb-2 block">
              {t('sales.selectItems')}
            </Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map((item) => {
                const sel = selectedItems[item.product_id];
                return (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-3 p-2 rounded-md border border-border hover:border-gold/30 transition-colors"
                  >
                    <Checkbox
                      checked={sel?.selected || false}
                      onCheckedChange={() => toggleItem(item.product_id, item.quantity)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted font-data">
                        {formatCurrency(item.unit_price)} x {item.quantity}
                      </p>
                    </div>
                    {sel?.selected && (
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted">{t('sales.qtyToRefund')}</Label>
                        <input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={sel.quantity}
                          onChange={(e) =>
                            updateQuantity(
                              item.product_id,
                              Math.min(item.quantity, Math.max(1, Number(e.target.value)))
                            )
                          }
                          className="w-14 h-7 text-center text-sm border border-border rounded bg-background font-data"
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
            <Label className="text-xs uppercase tracking-widest text-muted font-body mb-2 block">
              {t('sales.refundReason')}
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as RefundReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Customer Return">
                  {t('sales.refundReasonCustomerReturn')}
                </SelectItem>
                <SelectItem value="Cashier Error">{t('sales.refundReasonCashierError')}</SelectItem>
                <SelectItem value="Defective">{t('sales.refundReasonDefective')}</SelectItem>
                <SelectItem value="Other">{t('sales.refundReasonOther')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Restock toggle */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="restock"
              checked={restock}
              onCheckedChange={(v) => setRestock(v === true)}
            />
            <div>
              <Label htmlFor="restock" className="text-sm font-medium cursor-pointer">
                {t('sales.refundRestock')}
              </Label>
              <p className="text-xs text-muted">{t('sales.refundRestockDesc')}</p>
            </div>
          </div>

          {/* Refund amount summary */}
          <div className="flex justify-between items-center p-3 rounded-md bg-muted/30 border border-border">
            <span className="text-sm font-body">{t('sales.refundAmount')}</span>
            <span className="text-lg font-semibold text-blush font-data">
              {formatCurrency(refundAmount)}
            </span>
          </div>

          {refundAmount > maxRefundable && (
            <p className="text-xs text-destructive">
              Refund amount exceeds remaining refundable amount ({formatCurrency(maxRefundable)})
            </p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={
              !hasSelection ||
              mutation.isPending ||
              refundAmount > maxRefundable ||
              refundAmount <= 0
            }
            className="w-full"
          >
            {mutation.isPending ? t('sales.refundProcessing') : t('sales.refundSubmit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
