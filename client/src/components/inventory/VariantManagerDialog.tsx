import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from '../../i18n';
import type { Product, ProductVariant } from '@/types';

interface VariantManagerDialogProps {
  variantsDialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  variantsProduct: Product | null;
  variants: ProductVariant[] | undefined;
  variantsLoading: boolean;

  // Form state
  variantFormOpen: boolean;
  setVariantFormOpen: (open: boolean) => void;
  editingVariant: ProductVariant | null;
  variantDeleteId: number | null;
  setVariantDeleteId: (id: number | null) => void;

  // Form fields
  variantAttrs: Array<{ key: string; value: string }>;
  setVariantAttrs: (attrs: Array<{ key: string; value: string }>) => void;
  variantSku: string;
  setVariantSku: (value: string) => void;
  variantBarcode: string;
  setVariantBarcode: (value: string) => void;
  variantPrice: string;
  setVariantPrice: (value: string) => void;
  variantCostPrice: string;
  setVariantCostPrice: (value: string) => void;
  variantStock: string;
  setVariantStock: (value: string) => void;

  // Actions
  onOpenEditVariant: (variant: ProductVariant) => void;
  onVariantSubmit: () => void;
  onResetVariantForm: () => void;
  onDeleteVariant: (data: { productId: number; variantId: number }) => void;

  // Mutation states
  createVariantPending: boolean;
  updateVariantPending: boolean;
}

export default function VariantManagerDialog({
  variantsDialogOpen,
  onDialogOpenChange,
  variantsProduct,
  variants,
  variantsLoading,
  variantFormOpen,
  setVariantFormOpen,
  editingVariant,
  variantDeleteId,
  setVariantDeleteId,
  variantAttrs,
  setVariantAttrs,
  variantSku,
  setVariantSku,
  variantBarcode,
  setVariantBarcode,
  variantPrice,
  setVariantPrice,
  variantCostPrice,
  setVariantCostPrice,
  variantStock,
  setVariantStock,
  onOpenEditVariant,
  onVariantSubmit,
  onResetVariantForm,
  onDeleteVariant,
  createVariantPending,
  updateVariantPending,
}: VariantManagerDialogProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Manage Variants Dialog */}
      <Dialog open={variantsDialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {variantsProduct?.name} — {t('variants.manageVariants')}
            </DialogTitle>
            <DialogDescription>
              {t('variants.variantCount', { count: String(variants?.length || 0) })}
              {variants && variants.length > 0 && (
                <>
                  {' '}
                  · {t('variants.totalStock')}: {variants.reduce((s, v) => s + v.stock, 0)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Variant list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {variantsLoading ? (
              <p className="text-sm text-muted text-center py-4">{t('common.loading')}...</p>
            ) : variants && variants.length > 0 ? (
              variants.map((variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
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
                      SKU: {variant.sku}
                      {variant.barcode && <> · {variant.barcode}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-end me-2">
                      <p className="text-sm font-semibold text-gold font-data">
                        {formatCurrency(Number(variant.price || variantsProduct?.price || 0))}
                      </p>
                      <Badge
                        variant={variant.stock === 0 ? 'destructive' : 'success'}
                        className="text-[10px]"
                      >
                        {variant.stock}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onOpenEditVariant(variant)}
                    >
                      <Pencil className="h-3 w-3 text-gold" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setVariantDeleteId(variant.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted text-center py-4">
                {t('variants.title')} — {t('common.noResults')}
              </p>
            )}
          </div>

          {/* Add/Edit variant form */}
          {variantFormOpen ? (
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-sm font-semibold">
                {editingVariant ? t('variants.editVariant') : t('variants.addVariant')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.sku')}</Label>
                  <Input
                    value={variantSku}
                    onChange={(e) => setVariantSku(e.target.value)}
                    placeholder="SKU"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.barcode')}</Label>
                  <Input
                    value={variantBarcode}
                    onChange={(e) => setVariantBarcode(e.target.value)}
                    placeholder={t('variants.barcode')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.price')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variantPrice}
                    onChange={(e) => setVariantPrice(e.target.value)}
                    placeholder={t('variants.price')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.costPrice')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variantCostPrice}
                    onChange={(e) => setVariantCostPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('variants.stock')}</Label>
                  <Input
                    type="number"
                    value={variantStock}
                    onChange={(e) => setVariantStock(e.target.value)}
                  />
                </div>
              </div>
              {/* Attributes */}
              <div className="space-y-2">
                <Label className="text-xs">{t('variants.attributes')}</Label>
                {variantAttrs.map((attr, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder={t('variants.attributeName')}
                      value={attr.key}
                      onChange={(e) => {
                        const updated = [...variantAttrs];
                        updated[i] = { ...updated[i], key: e.target.value };
                        setVariantAttrs(updated);
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder={t('variants.attributeValue')}
                      value={attr.value}
                      onChange={(e) => {
                        const updated = [...variantAttrs];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setVariantAttrs(updated);
                      }}
                      className="flex-1"
                    />
                    {variantAttrs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setVariantAttrs(variantAttrs.filter((_, j) => j !== i))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVariantAttrs([...variantAttrs, { key: '', value: '' }])}
                >
                  <Plus className="h-3 w-3 me-1" />
                  {t('variants.addAttribute')}
                </Button>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={onResetVariantForm}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={onVariantSubmit}
                  disabled={createVariantPending || updateVariantPending}
                >
                  {editingVariant ? t('common.update') : t('common.create')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setVariantFormOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t('variants.addVariant')}
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Variant Confirmation */}
      <AlertDialog open={!!variantDeleteId} onOpenChange={() => setVariantDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('variants.deleteVariant')}</AlertDialogTitle>
            <AlertDialogDescription>{t('variants.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (variantDeleteId && variantsProduct) {
                  onDeleteVariant({
                    productId: variantsProduct.id,
                    variantId: variantDeleteId,
                  });
                }
              }}
              className="bg-destructive text-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
