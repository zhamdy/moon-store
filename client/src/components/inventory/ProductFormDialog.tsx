import { useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, Trash2, ImagePlus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import api from '../../services/api';
import { useTranslation } from '../../i18n';
import type { Product, Category, Distributor } from '@/types';
import type { z } from 'zod';

export interface ProductFormData {
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost_price: number;
  stock: number;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
  categories: Category[] | undefined;
  distributors: Distributor[] | undefined;
  onSubmit: (data: ProductFormData) => void;
  isSubmitting: boolean;
  getProductSchema: () => z.ZodSchema;
  onImageUpload: (productId: number, file: File) => void;
  onImageRemove: (productId: number) => void;
}

export default function ProductFormDialog({
  open,
  onOpenChange,
  editingProduct,
  categories,
  distributors,
  onSubmit,
  isSubmitting,
  getProductSchema,
  onImageUpload,
  onImageRemove,
}: ProductFormDialogProps) {
  const { t } = useTranslation();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(getProductSchema()),
  });

  const watchCategoryId = watch('category_id');

  // Populate form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingProduct) {
        reset({
          name: editingProduct.name,
          sku: editingProduct.sku,
          barcode: editingProduct.barcode || '',
          price: Number(editingProduct.price),
          cost_price: editingProduct.cost_price || 0,
          stock: editingProduct.stock,
          category_id: editingProduct.category_id,
          distributor_id: editingProduct.distributor_id,
          min_stock: editingProduct.min_stock,
        });
      } else {
        reset({
          name: '',
          sku: '',
          barcode: '',
          price: 0,
          cost_price: 0,
          stock: 0,
          category_id: null,
          distributor_id: null,
          min_stock: 5,
        });
        // Auto-generate barcode for new products
        api
          .get('/api/v1/products/generate-barcode')
          .then((r) => setValue('barcode', r.data.data.barcode))
          .catch(() => {});
      }
    }
  }, [open, editingProduct, reset, setValue]);

  // Auto-generate SKU when category changes (only for new products)
  useEffect(() => {
    if (!editingProduct && watchCategoryId && open) {
      api
        .get(`/api/v1/products/generate-sku/${watchCategoryId}`)
        .then((r) => setValue('sku', r.data.data.sku))
        .catch(() => {});
    }
  }, [watchCategoryId, editingProduct, open, setValue]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
    }
    onOpenChange(isOpen);
  };

  const handleFormSubmit = (data: ProductFormData) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? t('inventory.editProduct') : t('inventory.addProductTitle')}
          </DialogTitle>
          <DialogDescription>
            {editingProduct ? t('inventory.updateDetails') : t('inventory.addToInventory')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('common.name')}</Label>
              <Input {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('inventory.categoryCol')}</Label>
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(val) => field.onChange(val ? Number(val) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('inventory.selectCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {/* SKU & Barcode: read-only display for edit, hidden for create (auto-generated) */}
            {editingProduct ? (
              <div className="space-y-2">
                <Label>{t('inventory.sku')}</Label>
                <Input value={editingProduct.sku} readOnly className="bg-muted/20 cursor-default" />
              </div>
            ) : null}
            {editingProduct ? (
              <div className="space-y-2">
                <Label>{t('inventory.barcode')}</Label>
                <Input
                  value={editingProduct.barcode || '-'}
                  readOnly
                  className="bg-muted/20 cursor-default"
                />
              </div>
            ) : null}
            <input type="hidden" {...register('sku')} />
            <input type="hidden" {...register('barcode')} />
            <div className="space-y-2">
              <Label>{t('inventory.price')}</Label>
              <Input type="number" step="0.01" {...register('price')} />
              {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('inventory.costPrice')}</Label>
              <Input type="number" step="0.01" {...register('cost_price')} />
            </div>
            <div className="space-y-2">
              <Label>{t('inventory.stock')}</Label>
              <Input type="number" {...register('stock')} />
              {errors.stock && <p className="text-xs text-destructive">{errors.stock.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('inventory.distributor')}</Label>
              <Controller
                name="distributor_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : 'none'}
                    onValueChange={(val) => field.onChange(val === 'none' ? null : Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('inventory.selectDistributor')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('inventory.noDistributor')}</SelectItem>
                      {distributors?.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('inventory.minStockAlert')}</Label>
              <Input type="number" {...register('min_stock')} />
            </div>
          </div>

          {/* Image upload (only for existing products) */}
          {editingProduct && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label>{t('inventory.productImage')}</Label>
              <div className="flex items-center gap-3">
                {editingProduct.image_url ? (
                  <img
                    src={`${api.defaults.baseURL}${editingProduct.image_url}`}
                    alt={editingProduct.name}
                    className="h-16 w-16 rounded object-cover border border-border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded bg-muted/30 flex items-center justify-center border border-dashed border-border">
                    <ImagePlus className="h-6 w-6 text-muted" />
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    ref={imageInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && editingProduct) {
                        onImageUpload(editingProduct.id, file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 me-1" />
                    {t('inventory.uploadImage')}
                  </Button>
                  {editingProduct.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => onImageRemove(editingProduct.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 me-1" />
                      {t('inventory.removeImage')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {editingProduct ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Export a helper to prepare form values for editing
export function getEditFormValues(product: Product) {
  return {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode || '',
    price: Number(product.price),
    cost_price: product.cost_price || 0,
    stock: product.stock,
    category_id: product.category_id,
    distributor_id: product.distributor_id,
    min_stock: product.min_stock,
  };
}

export function getCreateFormValues() {
  return {
    name: '',
    sku: '',
    barcode: '',
    price: 0,
    cost_price: 0,
    stock: 0,
    category_id: null,
    distributor_id: null,
    min_stock: 5,
  };
}
