import { useState, useEffect } from 'react';
import { PackageCheck } from 'lucide-react';
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { Badge } from '../../../../shared';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { PurchaseOrderDetail } from '../../types';

interface PODetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PurchaseOrderDetail | undefined;
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

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'Draft':
        return (
          <Badge size="sm" variant="default">
            {t('po.draft')}
          </Badge>
        );
      case 'Sent':
        return (
          <Badge size="sm" variant="primary">
            {t('po.sent')}
          </Badge>
        );
      case 'Partially Received':
        return (
          <Badge size="sm" variant="warning">
            {t('po.partiallyReceived')}
          </Badge>
        );
      case 'Received':
        return (
          <Badge size="sm" variant="success">
            {t('po.fullyReceived')}
          </Badge>
        );
      case 'Cancelled':
        return (
          <Badge size="sm" variant="danger">
            {t('po.cancelled')}
          </Badge>
        );
      default:
        return (
          <Badge size="sm" variant="default">
            {status}
          </Badge>
        );
    }
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
    <Modal
      isOpen={open}
      onOpenChange={handleOpenChange}
      backdrop="blur"
      placement="center"
      size="2xl"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-border/50">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">
                  {detail?.po_number} — {detail?.distributor_name}
                </h3>
                <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  {getStatusChip(detail?.status || '')}
                  <span>
                    {t('po.total')}:{' '}
                    <span className="font-data font-semibold text-foreground">
                      {formatCurrency(detail?.total || 0)}
                    </span>
                  </span>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4">
              {detail?.notes && (
                <p className="text-sm text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-border/50">
                  {t('po.notes')}: {detail.notes}
                </p>
              )}

              <div className="space-y-2 max-h-72 overflow-y-auto">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1">
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
                      className="grid grid-cols-12 gap-2 items-center py-2 border-b border-border/40"
                    >
                      <div className="col-span-4">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground font-data">
                          {item.product_sku}
                        </p>
                      </div>
                      <span className="col-span-2 font-data text-foreground">{item.quantity}</span>
                      <span
                        className={`col-span-2 font-data font-semibold ${item.received_quantity >= item.quantity ? 'text-success' : item.received_quantity > 0 ? 'text-warning' : 'text-muted-foreground'}`}
                      >
                        {item.received_quantity}
                      </span>
                      <span className="col-span-2 font-data text-foreground">
                        {formatCurrency(item.cost_price)}
                      </span>
                      {receiveMode && (
                        <div className="col-span-2">
                          <input
                            type="number"
                            className="w-full h-8 px-2 text-sm font-data border border-border rounded-lg bg-background text-foreground"
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ModalBody>

            <ModalFooter className="border-t border-border/50">
              {receiveMode ? (
                <Button
                  color="primary"
                  size="sm"
                  onPress={handleReceive}
                  isLoading={isReceiving}
                  startContent={<PackageCheck className="h-4 w-4" />}
                >
                  {t('po.receive')}
                </Button>
              ) : (
                detail?.status !== 'Received' &&
                detail?.status !== 'Cancelled' && (
                  <Button
                    variant="bordered"
                    size="sm"
                    startContent={<PackageCheck className="h-4 w-4" />}
                    onPress={() => {
                      setReceiveMode(true);
                      setReceiveQtys({});
                    }}
                  >
                    {t('po.receive')}
                  </Button>
                )
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
