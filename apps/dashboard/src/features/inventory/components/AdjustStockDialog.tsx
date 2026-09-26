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
import type { Product, ProductVariant } from '../../../shared/types/index';

const products = resource<Product>('products');

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number | null;
  productName: string;
  currentStock: number;
  /**
   * A variant product's stock lives on its variant rows, so the adjustment has to name
   * one: `products.stock` is dead state no sale path reads, and an adjustment without a
   * variant would correct nothing a shopper can buy (MED-13).
   */
  hasVariants?: boolean;
}

/** "S / Red", from whatever attributes the variant carries. */
function variantLabel(variant: ProductVariant): string {
  const attrs =
    typeof variant.attributes === 'string'
      ? (JSON.parse(variant.attributes || '{}') as Record<string, string>)
      : ((variant.attributes ?? {}) as Record<string, string>);
  const values = Object.values(attrs).filter(Boolean);
  return values.length > 0 ? values.join(' / ') : variant.sku;
}

type AdjustReason = 'Manual Adjustment' | 'Damaged' | 'Stock Count';

export default function AdjustStockDialog({
  open,
  onOpenChange,
  productId,
  productName,
  currentStock,
  hasVariants = false,
}: AdjustStockDialogProps) {
  const { t } = useTranslation();

  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<AdjustReason>('Manual Adjustment');
  const [variantId, setVariantId] = useState<number | null>(null);

  const { data: variants } = products.useRead<ProductVariant[]>(
    `${productId}/variants`,
    undefined,
    hasVariants && productId !== null && open
  );
  const selectedVariant = variants?.find((v) => v.id === variantId) ?? null;
  // The figure being adjusted: the chosen size's stock, not the product column.
  const baseStock = hasVariants ? (selectedVariant?.stock ?? 0) : currentStock;

  const resetForm = () => {
    setDelta(0);
    setReason('Manual Adjustment');
    setVariantId(null);
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
    if (hasVariants && variantId === null) return;
    adjuster.run({
      id: productId,
      body: hasVariants ? { delta, reason, variant_id: variantId } : { delta, reason },
    });
  };

  const newStock = baseStock + delta;

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
              {hasVariants && (
                <Select
                  label={t('stock.variant')}
                  size="sm"
                  variant="bordered"
                  selectedKeys={variantId === null ? [] : [String(variantId)]}
                  onChange={(e) => setVariantId(e.target.value ? Number(e.target.value) : null)}
                  isRequired
                >
                  {(variants ?? []).map((variant) => (
                    <SelectItem key={String(variant.id)} textValue={variantLabel(variant)}>
                      {variantLabel(variant)} ({variant.stock})
                    </SelectItem>
                  ))}
                </Select>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-sm text-foreground">{t('stock.currentStock')}</span>
                <span className="text-lg font-semibold font-data">{baseStock}</span>
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
                onPress={() => {
                  onOpenChange(false);
                  resetForm();
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                color="primary"
                size="sm"
                onPress={handleSubmit}
                disabled={delta === 0 || newStock < 0 || (hasVariants && variantId === null)}
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
