import { useState, useEffect, useMemo, type Key } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search, UserPlus, Check } from 'lucide-react';
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';
import { useTranslation, t as tStandalone } from '../../../../shared/i18n/index';

import type { Customer, Product } from '../../../../shared/types/index';
import type { DeliveryOrder, DeliveryPayload, ShippingCompany } from '../../types';

const getDeliverySchema = () =>
  z.object({
    customer_id: z.coerce.number().optional().nullable(),
    customer_name: z.string().min(1, tStandalone('validation.nameRequired')),
    phone: z.string().min(1, tStandalone('validation.phoneRequired')),
    address: z.string().min(1, tStandalone('validation.addressRequired')),
    notes: z.string().optional(),
    estimated_delivery: z.string().optional().nullable(),
    shipping_company_id: z.coerce.number().optional().nullable(),
    tracking_number: z.string().optional().nullable(),
    shipping_cost: z.coerce.number().nonnegative().optional().nullable(),
    items: z
      .array(
        z.object({
          product_id: z.coerce.number().positive(),
          quantity: z.coerce.number().int().positive(),
        })
      )
      .min(1, tStandalone('validation.addItem')),
  });

type DeliveryFormData = z.infer<ReturnType<typeof getDeliverySchema>>;

// String keys keep the "new customer" affordance from ever colliding with a numeric customer id.
const NEW_CUSTOMER_KEY = 'new-customer';
const customerOptionKey = (id: number) => `customer-${id}`;

interface DeliveryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: DeliveryOrder | null;
  products: Product[] | undefined;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  hasMoreProducts?: boolean;
  onLoadMoreProducts: () => void;
  isLoadingMoreProducts: boolean;
  customers: Customer[] | undefined;
  isLoadingCustomers?: boolean;
  hasCustomerLoadError?: boolean;
  shippingCompanies: ShippingCompany[] | undefined;
  onSubmit: (payload: DeliveryPayload) => void;
  isSubmitting: boolean;
  customerSearch: string;
  onCustomerSearchChange: (search: string) => void;
  onOpenCompaniesDialog: () => void;
}

export default function DeliveryFormDialog({
  open,
  onOpenChange,
  editingOrder,
  products,
  productSearch,
  onProductSearchChange,
  hasMoreProducts,
  onLoadMoreProducts,
  isLoadingMoreProducts,
  customers,
  isLoadingCustomers = false,
  hasCustomerLoadError = false,
  shippingCompanies,
  onSubmit,
  isSubmitting,
  customerSearch,
  onCustomerSearchChange,
  onOpenCompaniesDialog,
}: DeliveryFormDialogProps) {
  const { t } = useTranslation();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
    setValue,
  } = useForm<DeliveryFormData>({
    resolver: zodResolver(getDeliverySchema()),
    defaultValues: {
      customer_id: null,
      customer_name: '',
      phone: '',
      address: '',
      notes: '',
      estimated_delivery: '',
      shipping_company_id: null,
      tracking_number: '',
      shipping_cost: 0,
      items: [{ product_id: 0, quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Reset form when dialog opens/closes or editingOrder changes
  useEffect(() => {
    if (open && !editingOrder) {
      setSelectedCustomer(null);
      setIsNewCustomer(false);
      onCustomerSearchChange('');
      const defaultEstimated = new Date();
      defaultEstimated.setDate(defaultEstimated.getDate() + 3);
      const estimatedStr = defaultEstimated.toISOString().slice(0, 16);
      reset({
        customer_id: null,
        customer_name: '',
        phone: '',
        address: '',
        notes: '',
        estimated_delivery: estimatedStr,
        shipping_company_id: null,
        tracking_number: '',
        shipping_cost: 0,
        items: [{ product_id: 0, quantity: 1 }],
      });
    }
  }, [open, editingOrder, reset, onCustomerSearchChange]);

  const handleFormSubmit = (data: DeliveryFormData) => {
    const payload: DeliveryPayload = {
      ...data,
      customer_id: selectedCustomer?.id || null,
      shipping_company_id: data.shipping_company_id || null,
      tracking_number: data.tracking_number || null,
      shipping_cost: data.shipping_cost || null,
      estimated_delivery: data.estimated_delivery || null,
      items: data.items.map((i) => ({
        product_id: Number(i.product_id),
        quantity: Number(i.quantity),
      })),
    };

    onSubmit(payload);
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsNewCustomer(false);
    setValue('customer_name', customer.name);
    setValue('phone', customer.phone);
    setValue('address', customer.address || '');
  };

  const selectNewCustomer = () => {
    setSelectedCustomer(null);
    setIsNewCustomer(true);
    setValue('customer_name', '');
    setValue('phone', '');
    setValue('address', '');
  };

  // The selected customer stays in the list even after the remote search moves on,
  // so a later query can never silently drop the selection the form was built from.
  const customerOptions = useMemo(() => {
    const results = customers ?? [];
    if (selectedCustomer && !results.some((c) => c.id === selectedCustomer.id)) {
      return [selectedCustomer, ...results];
    }
    return results;
  }, [customers, selectedCustomer]);

  const selectedCustomerKey = selectedCustomer
    ? customerOptionKey(selectedCustomer.id)
    : isNewCustomer
      ? NEW_CUSTOMER_KEY
      : null;

  const handleCustomerSelection = (key: Key | null) => {
    if (key === null) {
      // Cleared: drop the selection but keep whatever the cashier has already typed.
      setSelectedCustomer(null);
      setIsNewCustomer(false);
      return;
    }
    if (key === NEW_CUSTOMER_KEY) {
      selectNewCustomer();
      return;
    }
    const match = customerOptions.find((c) => customerOptionKey(c.id) === key);
    if (match) selectCustomer(match);
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onProductSearchChange('');
        onOpenChange(nextOpen);
      }}
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
                  {editingOrder ? t('deliveries.editOrder') : t('deliveries.newOrderTitle')}
                </h3>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {t('deliveries.fillDetails')}
                </p>
              </div>
            </ModalHeader>
            <ModalBody className="py-4 space-y-4">
              {/* Customer selector */}
              <div className="space-y-1.5">
                {/*
                 * The visible label is its own element, and the accessible name comes from
                 * `aria-label` rather than HeroUI's `label` prop (#111).
                 *
                 * That prop emits `aria-labelledby` *as well as* `aria-label`, pointing at
                 * the input itself and at an id that does not exist, so the name resolves
                 * to nothing in a real browser — `aria-labelledby` wins the accessible-name
                 * algorithm. jsdom's implementation quietly falls back to `aria-label`,
                 * which is why the unit tests disagreed with Playwright.
                 *
                 * Naming the field with an attribute rather than a reference also survives
                 * the popover: opening the list marks everything outside it `aria-hidden`,
                 * which empties any name computed from a referenced element.
                 */}
                <p className="text-xs font-medium text-foreground" aria-hidden="true">
                  {t('deliveries.selectCustomer')}
                </p>
                <Autocomplete
                  aria-label={t('deliveries.selectCustomer')}
                  placeholder={t('deliveries.searchCustomer')}
                  size="sm"
                  variant="bordered"
                  startContent={<Search className="h-4 w-4 text-muted-foreground shrink-0" />}
                  inputValue={customerSearch}
                  onInputChange={onCustomerSearchChange}
                  selectedKey={selectedCustomerKey}
                  onSelectionChange={handleCustomerSelection}
                  // Results are already filtered by the server; filtering them again
                  // client-side would hide rows the query deliberately returned.
                  defaultFilter={() => true}
                  allowsEmptyCollection
                  isLoading={isLoadingCustomers}
                  isInvalid={hasCustomerLoadError}
                  errorMessage={hasCustomerLoadError ? t('common.error') : undefined}
                  description={
                    !hasCustomerLoadError &&
                    !isLoadingCustomers &&
                    customerSearch.length > 0 &&
                    customerOptions.length === 0
                      ? t('deliveries.noCustomersFound')
                      : undefined
                  }
                  data-testid="delivery-customer-picker"
                >
                  {[
                    <AutocompleteItem
                      key={NEW_CUSTOMER_KEY}
                      textValue={t('deliveries.newCustomer')}
                      startContent={<UserPlus className="h-4 w-4 text-primary shrink-0" />}
                      endContent={
                        isNewCustomer ? <Check className="h-4 w-4 text-primary" /> : undefined
                      }
                    >
                      <span className="font-medium">{t('deliveries.newCustomer')}</span>
                    </AutocompleteItem>,
                    ...customerOptions.map((c) => (
                      <AutocompleteItem
                        key={customerOptionKey(c.id)}
                        textValue={c.name}
                        endContent={
                          selectedCustomer?.id === c.id ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : undefined
                        }
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground font-data">{c.phone}</div>
                        </div>
                      </AutocompleteItem>
                    )),
                  ]}
                </Autocomplete>
              </div>

              {/*
                HeroUI's Input keeps its own controlled value, so an imperative
                setValue from the picker is overwritten on the next render. These
                three fields are the ones the picker writes, so they are bound
                through Controller rather than register.
              */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Controller
                  control={control}
                  name="customer_name"
                  render={({ field }) => (
                    <Input
                      label={t('deliveries.customerName')}
                      size="sm"
                      variant="bordered"
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      isInvalid={!!errors.customer_name}
                      errorMessage={errors.customer_name?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <Input
                      label={t('deliveries.phone')}
                      size="sm"
                      variant="bordered"
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      isInvalid={!!errors.phone}
                      errorMessage={errors.phone?.message}
                    />
                  )}
                />
              </div>
              <Controller
                control={control}
                name="address"
                render={({ field }) => (
                  <Textarea
                    label={t('deliveries.address')}
                    size="sm"
                    variant="bordered"
                    minRows={2}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                    isInvalid={!!errors.address}
                    errorMessage={errors.address?.message}
                  />
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Textarea
                  label={t('deliveries.notes')}
                  size="sm"
                  variant="bordered"
                  minRows={2}
                  {...register('notes')}
                />
                <Input
                  type="datetime-local"
                  label={t('deliveries.estimatedDelivery')}
                  size="sm"
                  variant="bordered"
                  {...register('estimated_delivery')}
                />
              </div>

              {/* Shipping fields */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">
                    {t('deliveries.shippingCompany')}
                  </p>
                  <Button
                    type="button"
                    variant="light"
                    color="primary"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onPress={onOpenCompaniesDialog}
                  >
                    {t('deliveries.manageCompanies')}
                  </Button>
                </div>
                <select
                  {...register('shipping_company_id')}
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-data text-foreground"
                >
                  <option value="">{t('deliveries.noCompany')}</option>
                  {shippingCompanies?.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('deliveries.trackingNumber')}
                  size="sm"
                  variant="bordered"
                  {...register('tracking_number')}
                  placeholder="e.g. 1234567890"
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label={t('deliveries.shippingCost')}
                  size="sm"
                  variant="bordered"
                  {...register('shipping_cost')}
                />
              </div>

              {/* Items */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-foreground">{t('deliveries.items')}</p>
                  <Button
                    type="button"
                    variant="bordered"
                    size="sm"
                    startContent={<Plus className="h-3.5 w-3.5" />}
                    onPress={() => append({ product_id: 0, quantity: 1 })}
                  >
                    {t('deliveries.addItem')}
                  </Button>
                </div>
                {errors.items?.root && (
                  <p className="text-xs text-danger">{errors.items.root.message}</p>
                )}
                <Input
                  aria-label="Search products"
                  placeholder={t('common.search')}
                  size="sm"
                  variant="bordered"
                  value={productSearch}
                  onValueChange={onProductSearchChange}
                />
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <select
                          {...register(`items.${index}.product_id`)}
                          className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-data text-foreground"
                        >
                          <option value="">{t('deliveries.selectProduct')}</option>
                          {products
                            ?.filter((p) => p.status === 'active')
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.stock} in stock)
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          min="1"
                          size="sm"
                          variant="bordered"
                          {...register(`items.${index}.quantity`)}
                        />
                      </div>
                      {fields.length > 1 && (
                        <Button
                          isIconOnly
                          type="button"
                          variant="light"
                          color="danger"
                          size="sm"
                          onPress={() => remove(index)}
                          aria-label={t('common.remove')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {hasMoreProducts && (
                  <Button
                    fullWidth
                    type="button"
                    variant="bordered"
                    size="sm"
                    onPress={onLoadMoreProducts}
                    isLoading={isLoadingMoreProducts}
                    aria-label="Load more products"
                  >
                    Load more
                  </Button>
                )}
              </div>
            </ModalBody>
            <ModalFooter className="border-t border-border/50">
              <Button variant="flat" size="sm" onPress={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button color="primary" size="sm" type="submit" isLoading={isSubmitting}>
                {editingOrder ? t('common.update') : t('deliveries.createOrder')}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
