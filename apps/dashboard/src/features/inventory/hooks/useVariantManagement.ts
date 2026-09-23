import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import type { Product, ProductVariant } from '../../../shared/types/index';
import { validateVariantDraft, type VariantField } from '../lib/variantDraft';

type VariantFieldErrors = Partial<Record<VariantField, string>>;

const products = resource<Product>('products');

/**
 * A product's variants live under the product, so every read and write here is
 * a sub-path of one product record rather than a collection of its own. The
 * record being addressed is chosen per call; the segment beneath it is fixed at
 * hook creation, which is why the variant being edited or deleted has to be in
 * state before its action hook can name it.
 */
export function useVariantManagement() {
  const { t } = useTranslation();

  // Variant dialog state
  const [variantsDialogOpen, setVariantsDialogOpen] = useState(false);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [variantFormOpen, setVariantFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantDeleteId, setVariantDeleteId] = useState<number | null>(null);

  // Variant form fields
  const [variantAttrs, setVariantAttrs] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);
  const [variantSku, setVariantSku] = useState('');
  const [variantBarcode, setVariantBarcode] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantCostPrice, setVariantCostPrice] = useState('');
  const [variantStock, setVariantStock] = useState('0');
  const [variantErrors, setVariantErrors] = useState<VariantFieldErrors>({});

  const { data: variants, isLoading: variantsLoading } = products.useRead<ProductVariant[]>(
    `${variantsProduct?.id}/variants`,
    undefined,
    !!variantsProduct && variantsDialogOpen
  );

  const resetVariantForm = () => {
    setVariantFormOpen(false);
    setEditingVariant(null);
    setVariantAttrs([{ key: '', value: '' }]);
    setVariantSku('');
    setVariantBarcode('');
    setVariantPrice('');
    setVariantCostPrice('');
    setVariantStock('0');
  };

  // Writing a variant refreshes every products read, which is both the variant
  // list on screen and the variant counts in the inventory table.
  const creator = products.useAction('variants', {
    message: t('variants.created'),
    fallbackMessage: t('variants.createFailed'),
    onDone: resetVariantForm,
  });

  const updater = products.useAction(`variants/${editingVariant?.id}`, {
    method: 'PUT',
    message: t('variants.updated'),
    fallbackMessage: t('variants.updateFailed'),
    onDone: resetVariantForm,
  });

  const deleter = products.useAction(`variants/${variantDeleteId}`, {
    method: 'DELETE',
    message: t('variants.deleted'),
    fallbackMessage: t('variants.deleteFailed'),
    onDone: () => setVariantDeleteId(null),
  });

  const openEditVariant = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setVariantSku(variant.sku);
    setVariantBarcode(variant.barcode || '');
    setVariantPrice(variant.price != null ? String(variant.price) : '');
    setVariantCostPrice(variant.cost_price ? String(variant.cost_price) : '');
    setVariantStock(String(variant.stock));
    setVariantAttrs(Object.entries(variant.attributes).map(([key, value]) => ({ key, value })));
    setVariantFormOpen(true);
  };

  const handleVariantSubmit = () => {
    if (!variantsProduct) return;
    // Parsed, not coerced: `Number(stock) || 0` turned a typo into a valid request that
    // created the variant with stock 0 and said nothing (MED-12).
    const { errors, body } = validateVariantDraft(
      {
        sku: variantSku,
        barcode: variantBarcode,
        price: variantPrice,
        costPrice: variantCostPrice,
        stock: variantStock,
        attributes: variantAttrs,
      },
      {
        skuRequired: t('variants.skuRequired'),
        pricePositive: t('variants.pricePositive'),
        costNonNegative: t('variants.costNonNegative'),
        stockInteger: t('variants.stockInteger'),
        attributesRequired: t('variants.attributesRequired'),
      }
    );

    setVariantErrors(errors);
    if (!body) {
      // The inline errors are the fix instruction; the toast is the announcement, since
      // the dialog's fields are not a live region.
      toast.error(Object.values(errors)[0]!);
      return;
    }

    const write = editingVariant ? updater : creator;
    write.run({ id: variantsProduct.id, body });
  };

  // The variant is already named by the hook, so the caller only has to confirm.
  const deleteVariant = () => {
    if (!variantsProduct || !variantDeleteId) return;
    deleter.run({ id: variantsProduct.id });
  };

  const openVariantsDialog = (product: Product) => {
    setVariantsProduct(product);
    setVariantsDialogOpen(true);
  };

  const closeVariantsDialog = () => {
    setVariantsDialogOpen(false);
    setVariantsProduct(null);
    resetVariantForm();
  };

  return {
    // Dialog state
    variantsDialogOpen,
    setVariantsDialogOpen,
    variantsProduct,
    setVariantsProduct,
    variantFormOpen,
    setVariantFormOpen,
    editingVariant,
    variantDeleteId,
    setVariantDeleteId,

    // Form fields
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
    variantErrors,
    setVariantStock,

    // Data
    variants,
    variantsLoading,

    // Actions
    resetVariantForm,
    openEditVariant,
    handleVariantSubmit,
    deleteVariant,
    openVariantsDialog,
    closeVariantsDialog,
    createVariantPending: creator.isRunning,
    updateVariantPending: updater.isRunning,
  };
}
