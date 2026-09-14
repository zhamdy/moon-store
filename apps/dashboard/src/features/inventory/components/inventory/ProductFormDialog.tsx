import { useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  Textarea,
} from '@heroui/react';
import { useTransport } from '../../../../shared/lib/transport/index';
import { useTranslation } from '../../../../shared/i18n/index';
import type { Product, Category, Distributor } from '../../../../shared/types/index';
import type { ProductFormData } from '../../types';
import type { z } from 'zod';
import { slugify } from '../../lib/slug';
import SingleImageControl from './SingleImageControl';
import ProductGalleryManager from './ProductGalleryManager';

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
  /** The server's refusal of the slug (409 or 400), shown on the field itself. */
  slugError?: string | null;
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
  slugError = null,
}: ProductFormDialogProps) {
  const { t } = useTranslation();
  const transport = useTransport();
  /**
   * Whether the operator owns the slug. Until they do, it follows the English name. An
   * existing slug counts as owned: it is already in links, and a rename must be deliberate.
   */
  const slugTouched = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(getProductSchema()),
  });

  const watchCategoryId = watch('category_id');

  // Populate form when dialog opens
  useEffect(() => {
    // A barcode that lands after the dialog closed or reopened on another product is stale.
    let ignore = false;
    if (open) {
      if (editingProduct) {
        slugTouched.current = Boolean(editingProduct.slug);
        reset(getEditFormValues(editingProduct));
      } else {
        slugTouched.current = false;
        reset(getCreateFormValues());
        // Auto-generate barcode for new products
        transport
          .request<{ barcode: string }>({ method: 'GET', path: 'products/generate-barcode' })
          .then(({ data }) => {
            if (!ignore) setValue('barcode', data.barcode);
          })
          .catch(() => {});
      }
    }
    return () => {
      ignore = true;
    };
  }, [open, editingProduct, reset, setValue, transport]);

  useEffect(() => {
    if (slugError) setError('slug', { type: 'server', message: slugError });
  }, [slugError, setError]);

  // Auto-generate SKU when category changes (only for new products)
  useEffect(() => {
    // Only the SKU for the category still selected may land; an earlier pick's answer is dropped.
    let ignore = false;
    if (!editingProduct && watchCategoryId && open) {
      transport
        .request<{ sku: string }>({
          method: 'GET',
          path: `products/generate-sku/${watchCategoryId}`,
        })
        .then(({ data }) => {
          if (!ignore) setValue('sku', data.sku);
        })
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
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

                {/* Controller, not register: the slug is written by code as well as typed. */}
                <Controller
                  name="name_en"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label={t('catalog.nameEn')}
                      size="sm"
                      variant="bordered"
                      dir="ltr"
                      value={field.value ?? ''}
                      onBlur={field.onBlur}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (!slugTouched.current) setValue('slug', slugify(value));
                      }}
                      isInvalid={!!errors.name_en}
                      errorMessage={errors.name_en?.message}
                    />
                  )}
                />
                <Controller
                  name="slug"
                  control={control}
                  render={({ field }) => (
                    <Input
                      label={t('catalog.slug')}
                      size="sm"
                      variant="bordered"
                      dir="ltr"
                      value={field.value ?? ''}
                      onBlur={field.onBlur}
                      onValueChange={(value) => {
                        // Clearing it hands the slug back to the suggestion.
                        slugTouched.current = value !== '';
                        field.onChange(value);
                        // A server refusal describes the old value; editing answers it.
                        clearErrors('slug');
                      }}
                      description={t('catalog.slugHelp')}
                      isInvalid={!!errors.slug}
                      errorMessage={errors.slug?.message}
                    />
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Controller: HeroUI's Textarea holds its own controlled value, so
                    react-hook-form's `reset` on dialog open never reaches it otherwise. */}
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      label={t('inventory.description')}
                      size="sm"
                      variant="bordered"
                      dir="rtl"
                      minRows={2}
                      value={field.value ?? ''}
                      onBlur={field.onBlur}
                      onValueChange={field.onChange}
                      isInvalid={!!errors.description}
                      errorMessage={errors.description?.message}
                    />
                  )}
                />
                <Controller
                  name="description_en"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      label={t('catalog.descriptionEn')}
                      size="sm"
                      variant="bordered"
                      dir="ltr"
                      minRows={2}
                      value={field.value ?? ''}
                      onBlur={field.onBlur}
                      onValueChange={field.onChange}
                      isInvalid={!!errors.description_en}
                      errorMessage={errors.description_en?.message}
                    />
                  )}
                />
              </div>

              {/* The storefront product page's Details tab; same Controller reason as above. */}
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium mb-2">
                  {t('inventory.productDetails')}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Controller
                    name="material"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label={t('inventory.material')}
                        size="sm"
                        variant="bordered"
                        dir="rtl"
                        minRows={2}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onValueChange={field.onChange}
                        isInvalid={!!errors.material}
                        errorMessage={errors.material?.message}
                      />
                    )}
                  />
                  <Controller
                    name="material_en"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label={t('inventory.materialEn')}
                        size="sm"
                        variant="bordered"
                        dir="ltr"
                        minRows={2}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onValueChange={field.onChange}
                        isInvalid={!!errors.material_en}
                        errorMessage={errors.material_en?.message}
                      />
                    )}
                  />
                  <Controller
                    name="care"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label={t('inventory.care')}
                        size="sm"
                        variant="bordered"
                        dir="rtl"
                        minRows={2}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onValueChange={field.onChange}
                        isInvalid={!!errors.care}
                        errorMessage={errors.care?.message}
                      />
                    )}
                  />
                  <Controller
                    name="care_en"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label={t('inventory.careEn')}
                        size="sm"
                        variant="bordered"
                        dir="ltr"
                        minRows={2}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onValueChange={field.onChange}
                        isInvalid={!!errors.care_en}
                        errorMessage={errors.care_en?.message}
                      />
                    )}
                  />
                  <Controller
                    name="fit"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label={t('inventory.fit')}
                        size="sm"
                        variant="bordered"
                        dir="rtl"
                        minRows={2}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onValueChange={field.onChange}
                        isInvalid={!!errors.fit}
                        errorMessage={errors.fit?.message}
                      />
                    )}
                  />
                  <Controller
                    name="fit_en"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label={t('inventory.fitEn')}
                        size="sm"
                        variant="bordered"
                        dir="ltr"
                        minRows={2}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onValueChange={field.onChange}
                        isInvalid={!!errors.fit_en}
                        errorMessage={errors.fit_en?.message}
                      />
                    )}
                  />
                </div>
              </fieldset>

              {/* Images address the product by id, so they appear once it exists. */}
              {editingProduct && (
                <>
                  <SingleImageControl
                    label={t('inventory.productImage')}
                    imageUrl={editingProduct.image_url}
                    alt={editingProduct.name}
                    onUpload={(file) => onImageUpload(editingProduct.id, file)}
                    onRemove={() => onImageRemove(editingProduct.id)}
                  />
                  <ProductGalleryManager
                    productId={editingProduct.id}
                    productName={editingProduct.name}
                  />
                </>
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
    name_en: product.name_en ?? '',
    description: product.description ?? '',
    description_en: product.description_en ?? '',
    material: product.material ?? '',
    material_en: product.material_en ?? '',
    care: product.care ?? '',
    care_en: product.care_en ?? '',
    fit: product.fit ?? '',
    fit_en: product.fit_en ?? '',
    slug: product.slug ?? '',
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
    name_en: '',
    description: '',
    description_en: '',
    material: '',
    material_en: '',
    care: '',
    care_en: '',
    fit: '',
    fit_en: '',
    slug: '',
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
