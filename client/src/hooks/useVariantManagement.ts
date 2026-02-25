import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTranslation } from '../i18n';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse, Product, ProductVariant } from '@/types';

export function useVariantManagement() {
  const queryClient = useQueryClient();
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

  // Variants query
  const { data: variants, isLoading: variantsLoading } = useQuery<ProductVariant[]>({
    queryKey: ['product-variants', variantsProduct?.id],
    queryFn: () =>
      api.get(`/api/v1/products/${variantsProduct!.id}/variants`).then((r) => r.data.data),
    enabled: !!variantsProduct && variantsDialogOpen,
  });

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

  const createVariantMutation = useMutation({
    mutationFn: (data: { productId: number; variant: Record<string, unknown> }) =>
      api.post(`/api/v1/products/${data.productId}/variants`, data.variant),
    onSuccess: () => {
      toast.success(t('variants.created'));
      queryClient.invalidateQueries({ queryKey: ['product-variants', variantsProduct?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetVariantForm();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('variants.createFailed')),
  });

  const updateVariantMutation = useMutation({
    mutationFn: (data: {
      productId: number;
      variantId: number;
      variant: Record<string, unknown>;
    }) => api.put(`/api/v1/products/${data.productId}/variants/${data.variantId}`, data.variant),
    onSuccess: () => {
      toast.success(t('variants.updated'));
      queryClient.invalidateQueries({ queryKey: ['product-variants', variantsProduct?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      resetVariantForm();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('variants.updateFailed')),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (data: { productId: number; variantId: number }) =>
      api.delete(`/api/v1/products/${data.productId}/variants/${data.variantId}`),
    onSuccess: () => {
      toast.success(t('variants.deleted'));
      queryClient.invalidateQueries({ queryKey: ['product-variants', variantsProduct?.id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setVariantDeleteId(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('variants.deleteFailed')),
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
    const attributes: Record<string, string> = {};
    for (const attr of variantAttrs) {
      if (attr.key.trim() && attr.value.trim()) {
        attributes[attr.key.trim()] = attr.value.trim();
      }
    }
    if (Object.keys(attributes).length === 0) {
      toast.error(t('variants.attributes') + ' required');
      return;
    }
    const payload = {
      sku: variantSku,
      barcode: variantBarcode || null,
      price: variantPrice ? Number(variantPrice) : null,
      cost_price: variantCostPrice ? Number(variantCostPrice) : 0,
      stock: Number(variantStock) || 0,
      attributes,
    };
    if (editingVariant && variantsProduct) {
      updateVariantMutation.mutate({
        productId: variantsProduct.id,
        variantId: editingVariant.id,
        variant: payload,
      });
    } else if (variantsProduct) {
      createVariantMutation.mutate({ productId: variantsProduct.id, variant: payload });
    }
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
    setVariantStock,

    // Data
    variants,
    variantsLoading,

    // Mutations
    createVariantMutation,
    updateVariantMutation,
    deleteVariantMutation,

    // Actions
    resetVariantForm,
    openEditVariant,
    handleVariantSubmit,
    openVariantsDialog,
    closeVariantsDialog,
  };
}
