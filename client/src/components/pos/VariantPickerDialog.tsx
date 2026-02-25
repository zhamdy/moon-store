import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from '../../i18n';
import type { Product, ProductVariant } from '@/types';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {product?.name} — {t('variants.selectVariant')}
          </DialogTitle>
          <DialogDescription>
            {t('variants.variantCount', { count: String(product?.variant_count || 0) })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {variants?.map((variant) => (
            <button
              key={variant.id}
              onClick={() => onSelectVariant(variant)}
              disabled={variant.stock === 0}
              className={`w-full flex items-center justify-between p-3 rounded-md border transition-colors text-start ${
                variant.stock === 0
                  ? 'opacity-50 cursor-not-allowed border-border'
                  : 'border-border hover:border-gold/50 cursor-pointer'
              }`}
            >
              <div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {Object.entries(variant.attributes).map(([key, value]) => (
                    <Badge key={key} variant="gold" className="text-[10px]">
                      {key}: {value}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted font-data">
                  {t('pos.sku')}: {variant.sku}
                </p>
              </div>
              <div className="text-end">
                <p className="text-sm font-semibold text-gold font-data">
                  {formatCurrency(Number(variant.price || product?.price || 0))}
                </p>
                <Badge
                  variant={
                    variant.stock === 0 ? 'destructive' : variant.stock <= 5 ? 'warning' : 'success'
                  }
                  className="text-[10px]"
                >
                  {variant.stock} {t('pos.inStock')}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
