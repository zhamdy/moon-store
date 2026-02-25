import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from '../../i18n';
import type { Product, Distributor } from '@/types';
import type { LineItem } from '../../hooks/usePurchaseOrderData';

interface POFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distributors: Distributor[] | undefined;
  products: Product[] | undefined;
  onSubmit: (data: {
    distributor_id: number;
    items: Array<{ product_id: number; quantity: number; cost_price: number }>;
    notes: string | null;
  }) => void;
  isSubmitting: boolean;
  /** Pre-filled distributor id (e.g. from auto-generate) */
  initialDistributorId?: string;
  /** Pre-filled line items (e.g. from auto-generate) */
  initialLineItems?: LineItem[];
}

export default function POFormDialog({
  open,
  onOpenChange,
  distributors,
  products,
  onSubmit,
  isSubmitting,
  initialDistributorId = '',
  initialLineItems,
}: POFormDialogProps) {
  const { t } = useTranslation();

  const [distributorId, setDistributorId] = useState(initialDistributorId);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems ?? []);
  const [addProductId, setAddProductId] = useState('');

  // Sync initial values when dialog opens with pre-filled data
  // (React will re-mount when key changes, handled by parent)
  const resetForm = () => {
    setDistributorId('');
    setNotes('');
    setLineItems([]);
    setAddProductId('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleAddLineItem = () => {
    if (!addProductId) return;
    const product = products?.find((p) => p.id === Number(addProductId));
    if (!product) return;
    if (lineItems.find((li) => li.product_id === product.id)) return;
    setLineItems([
      ...lineItems,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        cost_price: product.cost_price || 0,
      },
    ]);
    setAddProductId('');
  };

  const handleSubmit = () => {
    if (!distributorId || lineItems.length === 0) return;
    onSubmit({
      distributor_id: Number(distributorId),
      items: lineItems.map((li) => ({
        product_id: li.product_id,
        quantity: li.quantity,
        cost_price: li.cost_price,
      })),
      notes: notes || null,
    });
  };

  const lineTotal = lineItems.reduce((s, li) => s + li.quantity * li.cost_price, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('po.create')}</DialogTitle>
          <DialogDescription>{t('po.selectDistributor')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('po.distributor')}</Label>
              <Select value={distributorId} onValueChange={setDistributorId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('po.selectDistributor')} />
                </SelectTrigger>
                <SelectContent>
                  {distributors?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('po.notes')}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('po.notes')}
              />
            </div>
          </div>

          {/* Add product */}
          <div className="flex gap-2">
            <Select value={addProductId} onValueChange={setAddProductId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('po.selectProduct')} />
              </SelectTrigger>
              <SelectContent>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleAddLineItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Line items */}
          {lineItems.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted font-medium px-1">
                <span className="col-span-5">{t('po.product')}</span>
                <span className="col-span-2">{t('po.quantity')}</span>
                <span className="col-span-2">{t('po.costPrice')}</span>
                <span className="col-span-2">{t('po.total')}</span>
                <span className="col-span-1" />
              </div>
              {lineItems.map((li, i) => (
                <div key={li.product_id} className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-5 text-sm truncate">{li.product_name}</span>
                  <Input
                    type="number"
                    className="col-span-2 h-8"
                    value={li.quantity}
                    min={1}
                    onChange={(e) => {
                      const updated = [...lineItems];
                      updated[i] = { ...updated[i], quantity: Number(e.target.value) || 1 };
                      setLineItems(updated);
                    }}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    className="col-span-2 h-8"
                    value={li.cost_price}
                    onChange={(e) => {
                      const updated = [...lineItems];
                      updated[i] = { ...updated[i], cost_price: Number(e.target.value) || 0 };
                      setLineItems(updated);
                    }}
                  />
                  <span className="col-span-2 text-sm font-data text-gold">
                    {formatCurrency(li.quantity * li.cost_price)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-span-1 h-7 w-7"
                    onClick={() => setLineItems(lineItems.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end pt-2 border-t border-border">
                <span className="text-sm font-semibold text-gold">
                  {t('po.total')}: {formatCurrency(lineTotal)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-4">{t('po.noItems')}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!distributorId || lineItems.length === 0 || isSubmitting}
          >
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
