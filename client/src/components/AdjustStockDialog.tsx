import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Package } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import api from '../services/api';
import { useTranslation } from '../i18n';

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number | null;
  productName: string;
  currentStock: number;
}

type AdjustReason = 'Manual Adjustment' | 'Damaged' | 'Stock Count';

export default function AdjustStockDialog({
  open,
  onOpenChange,
  productId,
  productName,
  currentStock,
}: AdjustStockDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<AdjustReason>('Manual Adjustment');

  const resetForm = () => {
    setDelta(0);
    setReason('Manual Adjustment');
  };

  const mutation = useMutation({
    mutationFn: (data: { delta: number; reason: string }) =>
      api.post(`/api/v1/products/${productId}/adjust-stock`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success(t('stock.adjustSuccess'));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-low-stock'] });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast.error(t('stock.adjustFailed'));
    },
  });

  const handleSubmit = () => {
    if (delta === 0) return;
    mutation.mutate({ delta, reason });
  };

  const newStock = currentStock + delta;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wider">
            <Package className="h-5 w-5 text-gold" />
            {t('stock.adjustTitle')}
          </DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border">
            <span className="text-sm font-body">{t('stock.currentStock')}</span>
            <span className="text-lg font-semibold font-data">{currentStock}</span>
          </div>

          <div className="space-y-2">
            <Label>{t('stock.adjustment')}</Label>
            <Input
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              placeholder="+10 or -5"
            />
            <p className="text-xs text-muted">
              {t('stock.newStock')}:{' '}
              <span className={`font-semibold ${newStock < 0 ? 'text-destructive' : ''}`}>
                {newStock}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('stock.reason')}</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as AdjustReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Manual Adjustment">{t('stock.reasonManual')}</SelectItem>
                <SelectItem value="Damaged">{t('stock.reasonDamaged')}</SelectItem>
                <SelectItem value="Stock Count">{t('stock.reasonStockCount')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={delta === 0 || mutation.isPending || newStock < 0}
            className="w-full"
          >
            {mutation.isPending ? t('common.loading') : t('stock.adjustSubmit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
