import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { Badge } from '../../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { Product, ProductVariant } from '../../../../shared/types/index';

interface VariantPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  variants: ProductVariant[] | undefined;
  onSelectVariant: (variant: ProductVariant) => void;
}

export default function VariantPickerDialog({
  open,
  onOpenChange,
  product,
  variants,
  onSelectVariant,
}: VariantPickerDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
      backdrop="blur"
      placement="center"
      size="md"
      classNames={{
        base: 'bg-card text-card-foreground border border-border shadow-xl',
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold">
                  {product?.name} — {t('variants.selectVariant')}
                </h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {t('variants.variantCount', { count: String(product?.variant_count || 0) })}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-4">
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {variants?.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => onSelectVariant(variant)}
                    disabled={variant.stock === 0}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-start ${
                      variant.stock === 0
                        ? 'opacity-50 cursor-not-allowed border-border bg-muted/10'
                        : 'border-border hover:border-primary/50 hover:bg-muted/20 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {Object.entries(variant.attributes).map(([key, value]) => (
                          <Badge key={key} size="sm" variant="primary">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground font-data">
                        {t('pos.sku')}: {variant.sku}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold text-primary font-data">
                        {formatCurrency(Number(variant.price || product?.price || 0))}
                      </p>
                      <Badge
                        size="sm"
                        variant={
                          variant.stock === 0
                            ? 'danger'
                            : variant.stock <= 5
                              ? 'warning'
                              : 'success'
                        }
                        className="mt-0.5"
                      >
                        {variant.stock} {t('pos.inStock')}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
