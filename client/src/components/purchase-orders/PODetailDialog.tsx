import { useState, useEffect } from 'react';
import { PackageCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from '../../i18n';
import type { PODetail } from '../../hooks/usePurchaseOrderData';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'secondary',
  Sent: 'gold',
  'Partially Received': 'warning',
  Received: 'success',
  Cancelled: 'destructive',
};

interface PODetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PODetail | undefined;
  onReceive: (items: Array<{ item_id: number; quantity: number }>) => void;
  isReceiving: boolean;
  /** When true, opens directly in receive mode */
  initialReceiveMode?: boolean;
}

export default function PODetailDialog({
  open,
  onOpenChange,
  detail,
  onReceive,
  isReceiving,
  initialReceiveMode = false,
}: PODetailDialogProps) {
  const { t } = useTranslation();

  const [receiveMode, setReceiveMode] = useState(initialReceiveMode);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});

  // Sync receiveMode when dialog opens/closes or initialReceiveMode changes
  useEffect(() => {
    if (open) {
      setReceiveMode(initialReceiveMode);
      setReceiveQtys({});
    }
  }, [open, initialReceiveMode]);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      Draft: t('po.draft'),
      Sent: t('po.sent'),
      'Partially Received': t('po.partiallyReceived'),
      Received: t('po.fullyReceived'),
      Cancelled: t('po.cancelled'),
    };
    return map[status] || status;
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setReceiveMode(false);
      setReceiveQtys({});
    }
  };

  const handleReceive = () => {
    const items = Object.entries(receiveQtys)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ item_id: Number(itemId), quantity: qty }));
    if (items.length === 0) return;
    onReceive(items);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {detail?.po_number} — {detail?.distributor_name}
          </DialogTitle>
          <DialogDescription>
            <Badge
              variant={
                (STATUS_COLORS[detail?.status || ''] || 'secondary') as
                  | 'secondary'
                  | 'gold'
                  | 'warning'
                  | 'success'
                  | 'destructive'
              }
            >
              {statusLabel(detail?.status || '')}
            </Badge>{' '}
            {t('po.total')}: {formatCurrency(detail?.total || 0)}
          </DialogDescription>
        </DialogHeader>

        {detail?.notes && (
          <p className="text-sm text-muted">
            {t('po.notes')}: {detail.notes}
          </p>
        )}

        <div className="space-y-2 max-h-72 overflow-y-auto">
          <div className="grid grid-cols-12 gap-2 text-xs text-muted font-medium px-1">
            <span className="col-span-4">{t('po.product')}</span>
            <span className="col-span-2">{t('po.quantity')}</span>
            <span className="col-span-2">{t('po.received')}</span>
            <span className="col-span-2">{t('po.costPrice')}</span>
            {receiveMode && <span className="col-span-2">{t('po.receiveQty')}</span>}
          </div>
          {detail?.items.map((item) => {
            const remaining = item.quantity - item.received_quantity;
            return (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-2 items-center py-1 border-b border-border/50"
              >
                <div className="col-span-4">
                  <p className="text-sm truncate">{item.product_name}</p>
                  <p className="text-xs text-muted font-data">{item.product_sku}</p>
                </div>
                <span className="col-span-2 font-data">{item.quantity}</span>
                <span
                  className={`col-span-2 font-data ${item.received_quantity >= item.quantity ? 'text-emerald-400' : item.received_quantity > 0 ? 'text-amber-400' : 'text-muted'}`}
                >
                  {item.received_quantity}
                </span>
                <span className="col-span-2 font-data">{formatCurrency(item.cost_price)}</span>
                {receiveMode && (
                  <Input
                    type="number"
                    className="col-span-2 h-8"
                    min={0}
                    max={remaining}
                    value={receiveQtys[item.id] ?? ''}
                    placeholder={String(remaining)}
                    onChange={(e) =>
                      setReceiveQtys({
                        ...receiveQtys,
                        [item.id]: Math.min(Number(e.target.value) || 0, remaining),
                      })
                    }
                    disabled={remaining <= 0}
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          {receiveMode ? (
            <Button onClick={handleReceive} disabled={isReceiving}>
              <PackageCheck className="h-4 w-4 me-2" />
              {t('po.receive')}
            </Button>
          ) : (
            detail?.status !== 'Received' &&
            detail?.status !== 'Cancelled' && (
              <Button
                variant="outline"
                onClick={() => {
                  setReceiveMode(true);
                  setReceiveQtys({});
                }}
              >
                <PackageCheck className="h-4 w-4 me-2" />
                {t('po.receive')}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
