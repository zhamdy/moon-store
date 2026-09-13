import { useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, Trash2, ImagePlus } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
} from '@heroui/react';
import { useTransport } from '../../../../shared/lib/transport/index';
import { useTranslation } from '../../../../shared/i18n/index';
import type { Product, Category, Distributor } from '../../../../shared/types/index';
import type { ProductFormData } from '../../types';
import type { z } from 'zod';
import { assetUrl } from '../../../../shared/lib/apiBase';

/** Where the server serves uploaded product images from. */

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
  const transport = useTransport();

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
        transport
          .request<{ barcode: string }>({ method: 'GET', path: 'products/generate-barcode' })
          .then(({ data }) => setValue('barcode', data.barcode))
          .catch(() => {});
      }
    }
  }, [open, editingProduct, reset, setValue, transport]);

  // Auto-generate SKU when category changes (only for new products)
  useEffect(() => {
    if (!editingProduct && watchCategoryId && open) {
      transport
        .request<{ sku: string }>({
          method: 'GET',
          path: `products/generate-sku/${watchCategoryId}`,
        })
        .then(({ data }) => setValue('sku', data.sku))
        .catch(() => {});
    }
  }, [watchCategoryId, editingProduct, open, setValue, transport]);

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
    <Modal
      isOpen={open}
      onOpenChange={handleOpenChange}
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
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <ModalHeader className="border-b border-border/50">
              <div>
                <h3 className="text-base font-semibold">
                  {editingProduct ? t('inventory.editProduct') : t('inventory.addProductTitle')}
                </h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {editingProduct ? t('inventory.updateDetails') : t('inventory.addToInventory')}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('common.name')}
                  size="sm"
                  variant="bordered"
                  {...register('name')}
                  isInvalid={!!errors.name}
                  errorMessage={errors.name?.message}
                />
                <Controller
                  name="category_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label={t('inventory.categoryCol')}
                      size="sm"
                      variant="bordered"
                      placeholder={t('inventory.selectCategory')}
                      selectedKeys={field.value ? [String(field.value)] : []}
                      onChange={(e) =>
                        field.onChange(e.target.value ? Number(e.target.value) : null)
                      }
                    >
                      {categories?.map((cat) => (
                        <SelectItem key={String(cat.id)} textValue={cat.name}>
                          {cat.name}
                        </SelectItem>
                      )) || []}
                    </Select>
                  )}
                />

                {/* SKU & Barcode: read-only display for edit, hidden for create (auto-generated) */}
                {editingProduct ? (
                  <Input
                    label={t('inventory.sku')}
                    size="sm"
                    variant="bordered"
                    value={editingProduct.sku}
                    isReadOnly
                    className="cursor-default"
                  />
                ) : null}
                {editingProduct ? (
                  <Input
                    label={t('inventory.barcode')}
                    size="sm"
                    variant="bordered"
                    value={editingProduct.barcode || '-'}
                    isReadOnly
                    className="cursor-default"
                  />
                ) : null}
                <input type="hidden" {...register('sku')} />
                <input type="hidden" {...register('barcode')} />

                <Input
                  type="number"
                  step="0.01"
                  label={t('inventory.price')}
                  size="sm"
                  variant="bordered"
                  {...register('price')}
                  isInvalid={!!errors.price}
                  errorMessage={errors.price?.message}
                />
                <Input
                  type="number"
                  step="0.01"
                  label={t('inventory.costPrice')}
                  size="sm"
                  variant="bordered"
                  {...register('cost_price')}
                />
                <Input
                  type="number"
                  label={t('inventory.stock')}
                  size="sm"
                  variant="bordered"
                  {...register('stock')}
                  isInvalid={!!errors.stock}
                  errorMessage={errors.stock?.message}
                />
                <Controller
                  name="distributor_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label={t('inventory.distributor')}
                      size="sm"
                      variant="bordered"
                      placeholder={t('inventory.selectDistributor')}
                      selectedKeys={field.value ? [String(field.value)] : ['none']}
                      onChange={(e) =>
                        field.onChange(e.target.value === 'none' ? null : Number(e.target.value))
                      }
                    >
                      {[
                        <SelectItem key="none" textValue={t('inventory.noDistributor')}>
                          {t('inventory.noDistributor')}
                        </SelectItem>,
                        ...(distributors ?? []).map((d) => (
                          <SelectItem key={String(d.id)} textValue={d.name}>
                            {d.name}
                          </SelectItem>
                        )),
                      ]}
                    </Select>
                  )}
                />
                <Input
                  type="number"
                  label={t('inventory.minStockAlert')}
                  size="sm"
                  variant="bordered"
                  {...register('min_stock')}
                />
              </div>

              {/* Image upload (only for existing products) */}
              {editingProduct && (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-xs font-medium text-foreground">
                    {t('inventory.productImage')}
                  </p>
                  <div className="flex items-center gap-3">
                    {editingProduct.image_url ? (
                      <img
                        src={assetUrl(editingProduct.image_url)}
                        alt={editingProduct.name}
                        className="h-16 w-16 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted/30 flex items-center justify-center border border-dashed border-border">
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
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
                        variant="bordered"
                        size="sm"
                        startContent={<Upload className="h-3.5 w-3.5" />}
                        onPress={() => imageInputRef.current?.click()}
                      >
                        {t('inventory.uploadImage')}
                      </Button>
                      {editingProduct.image_url && (
                        <Button
                          type="button"
                          variant="light"
                          color="danger"
                          size="sm"
                          startContent={<Trash2 className="h-3.5 w-3.5" />}
                          onPress={() => onImageRemove(editingProduct.id)}
                        >
                          {t('inventory.removeImage')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>
            <ModalFooter className="border-t border-border/50">
              <Button variant="flat" size="sm" onPress={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button color="primary" size="sm" type="submit" isLoading={isSubmitting}>
                {editingProduct ? t('common.update') : t('common.create')}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
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
