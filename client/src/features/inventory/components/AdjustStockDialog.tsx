import { useState } from 'react';
import { Package } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
} from '@heroui/react';
import { resource } from '../../../shared/lib/resource';
import { useTranslation } from '../../../shared/i18n/index';
import type { Product } from '../../../shared/types/index';

const products = resource<Product>('products');

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

  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<AdjustReason>('Manual Adjustment');

  const resetForm = () => {
    setDelta(0);
    setReason('Manual Adjustment');
  };

  const adjuster = products.useAction('adjust-stock', {
    message: t('stock.adjustSuccess'),
    fallbackMessage: t('stock.adjustFailed'),
    onDone: () => {
      onOpenChange(false);
      resetForm();
    },
  });

  const handleSubmit = () => {
    if (delta === 0 || productId === null) return;
    adjuster.run({ id: productId, body: { delta, reason } });
  };

  const newStock = currentStock + delta;

  return (
    <Modal
      isOpen={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
      backdrop="blur"
      placement="center"
      size="md"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <div>
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {t('stock.adjustTitle')}
                </h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">{productName}</p>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-sm text-foreground">{t('stock.currentStock')}</span>
                <span className="text-lg font-semibold font-data">{currentStock}</span>
              </div>

              <div className="space-y-1">
                <Input
                  type="number"
                  label={t('stock.adjustment')}
                  size="sm"
                  variant="bordered"
                  value={String(delta)}
                  onValueChange={(val) => setDelta(Number(val) || 0)}
                  placeholder="+10 or -5"
                />
                <p className="text-xs text-muted-foreground">
                  {t('stock.newStock')}:{' '}
                  <span
                    className={`font-semibold ${newStock < 0 ? 'text-danger' : 'text-foreground'}`}
                  >
                    {newStock}
                  </span>
                </p>
              </div>

              <Select
                label={t('stock.reason')}
                size="sm"
                variant="bordered"
                selectedKeys={[reason]}
                onChange={(e) => {
                  if (e.target.value) setReason(e.target.value as AdjustReason);
                }}
              >
                <SelectItem key="Manual Adjustment" textValue={t('stock.reasonManual')}>
                  {t('stock.reasonManual')}
                </SelectItem>
                <SelectItem key="Damaged" textValue={t('stock.reasonDamaged')}>
                  {t('stock.reasonDamaged')}
                </SelectItem>
                <SelectItem key="Stock Count" textValue={t('stock.reasonStockCount')}>
                  {t('stock.reasonStockCount')}
                </SelectItem>
              </Select>
            </ModalBody>

            <ModalFooter className="border-t border-border/50">
              <Button
                variant="flat"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  resetForm();
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                color="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={delta === 0 || newStock < 0}
                isLoading={adjuster.isRunning}
              >
                {adjuster.isRunning ? t('common.loading') : t('stock.adjustSubmit')}
              </Button>
            </ModalFooter>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
