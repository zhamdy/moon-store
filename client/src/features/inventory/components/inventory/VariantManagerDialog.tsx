import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button, Input, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { Badge, ConfirmDialog } from '../../../../shared';
import { formatCurrency } from '../../../../shared/lib/utils';
import { useTranslation } from '../../../../shared/i18n/index';
import type { Product, ProductVariant } from '../../../../shared/types/index';

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
  onDeleteVariant: () => void;

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
      <Modal
        isOpen={variantsDialogOpen}
        onOpenChange={onDialogOpenChange}
        backdrop="blur"
        placement="center"
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {variantsProduct?.name} — {t('variants.manageVariants')}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('variants.variantCount', { count: String(variants?.length || 0) })}
                    {variants && variants.length > 0 && (
                      <>
                        {' '}
                        · {t('variants.totalStock')}: {variants.reduce((s, v) => s + v.stock, 0)}
                      </>
                    )}
                  </p>
                </div>
              </ModalHeader>

              <ModalBody className="py-4 space-y-4">
                {/* Variant list */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {variantsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('common.loading')}...
                    </p>
                  ) : variants && variants.length > 0 ? (
                    variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm"
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
                            SKU: {variant.sku}
                            {variant.barcode && <> · {variant.barcode}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-end me-2">
                            <p className="text-sm font-semibold text-primary font-data">
                              {formatCurrency(Number(variant.price || variantsProduct?.price || 0))}
                            </p>
                            <Badge size="sm" variant={variant.stock === 0 ? 'danger' : 'success'}>
                              {variant.stock}
                            </Badge>
                          </div>
                          <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => onOpenEditVariant(variant)}
                            aria-label={t('common.edit')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            isIconOnly
                            variant="light"
                            color="danger"
                            size="sm"
                            className="h-8 w-8"
                            onClick={() => setVariantDeleteId(variant.id)}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('variants.title')} — {t('common.noResults')}
                    </p>
                  )}
                </div>

                {/* Add/Edit variant form */}
                {variantFormOpen ? (
                  <div className="border-t border-border/50 pt-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">
                      {editingVariant ? t('variants.editVariant') : t('variants.addVariant')}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={t('variants.sku')}
                        size="sm"
                        variant="bordered"
                        value={variantSku}
                        onValueChange={setVariantSku}
                        placeholder="SKU"
                      />
                      <Input
                        label={t('variants.barcode')}
                        size="sm"
                        variant="bordered"
                        value={variantBarcode}
                        onValueChange={setVariantBarcode}
                        placeholder={t('variants.barcode')}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        label={t('variants.price')}
                        size="sm"
                        variant="bordered"
                        value={variantPrice}
                        onValueChange={setVariantPrice}
                        placeholder={t('variants.price')}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        label={t('variants.costPrice')}
                        size="sm"
                        variant="bordered"
                        value={variantCostPrice}
                        onValueChange={setVariantCostPrice}
                      />
                      <Input
                        type="number"
                        label={t('variants.stock')}
                        size="sm"
                        variant="bordered"
                        value={variantStock}
                        onValueChange={setVariantStock}
                      />
                    </div>
                    {/* Attributes */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">
                        {t('variants.attributes')}
                      </p>
                      {variantAttrs.map((attr, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <Input
                            placeholder={t('variants.attributeName')}
                            size="sm"
                            variant="bordered"
                            value={attr.key}
                            onValueChange={(val) => {
                              const updated = [...variantAttrs];
                              updated[i] = { ...updated[i], key: val };
                              setVariantAttrs(updated);
                            }}
                            className="flex-1"
                          />
                          <Input
                            placeholder={t('variants.attributeValue')}
                            size="sm"
                            variant="bordered"
                            value={attr.value}
                            onValueChange={(val) => {
                              const updated = [...variantAttrs];
                              updated[i] = { ...updated[i], value: val };
                              setVariantAttrs(updated);
                            }}
                            className="flex-1"
                          />
                          {variantAttrs.length > 1 && (
                            <Button
                              isIconOnly
                              variant="light"
                              color="danger"
                              size="sm"
                              className="h-8 w-8 shrink-0"
                              onClick={() =>
                                setVariantAttrs(variantAttrs.filter((_, j) => j !== i))
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="bordered"
                        size="sm"
                        startContent={<Plus className="h-3.5 w-3.5" />}
                        onClick={() => setVariantAttrs([...variantAttrs, { key: '', value: '' }])}
                      >
                        {t('variants.addAttribute')}
                      </Button>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="flat" size="sm" onClick={onResetVariantForm}>
                        {t('common.cancel')}
                      </Button>
                      <Button
                        color="primary"
                        size="sm"
                        onClick={onVariantSubmit}
                        isLoading={createVariantPending || updateVariantPending}
                      >
                        {editingVariant ? t('common.update') : t('common.create')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="bordered"
                    color="primary"
                    size="sm"
                    className="w-full"
                    startContent={<Plus className="h-4 w-4" />}
                    onClick={() => setVariantFormOpen(true)}
                  >
                    {t('variants.addVariant')}
                  </Button>
                )}
              </ModalBody>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Variant Confirmation */}
      <ConfirmDialog
        open={!!variantDeleteId}
        onOpenChange={(open) => {
          if (!open) setVariantDeleteId(null);
        }}
        title={t('variants.deleteVariant')}
        description={t('variants.deleteConfirm')}
        confirmText={t('common.delete')}
        confirmColor="danger"
        onConfirm={onDeleteVariant}
      />
    </>
  );
}
