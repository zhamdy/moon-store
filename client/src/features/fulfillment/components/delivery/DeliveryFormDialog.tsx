import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search, UserPlus, Check } from 'lucide-react';
import {
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

interface DeliveryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOrder: DeliveryOrder | null;
  products: Product[] | undefined;
  customers: Customer[] | undefined;
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
  customers,
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
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClick(e: globalThis.MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      setIsNewCustomer(true);
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
    setCustomerDropdownOpen(false);
    onCustomerSearchChange('');
    setValue('customer_name', customer.name);
    setValue('phone', customer.phone);
    setValue('address', customer.address || '');
  };

  const selectNewCustomer = () => {
    setSelectedCustomer(null);
    setIsNewCustomer(true);
    setCustomerDropdownOpen(false);
    onCustomerSearchChange('');
    setValue('customer_name', '');
    setValue('phone', '');
    setValue('address', '');
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={onOpenChange}
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
              <div className="space-y-1.5" ref={customerDropdownRef}>
                <p className="text-xs font-medium text-foreground">
                  {t('deliveries.selectCustomer')}
                </p>
                <div className="relative">
                  <div
                    className="flex h-10 w-full items-center rounded-lg border border-border bg-card px-3 py-2 text-sm cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
                  >
                    <Search className="h-4 w-4 me-2 text-muted-foreground shrink-0" />
                    {selectedCustomer ? (
                      <span className="truncate font-medium text-foreground">
                        {selectedCustomer.name} — {selectedCustomer.phone}
                      </span>
                    ) : isNewCustomer ? (
                      <span className="text-foreground">{t('deliveries.newCustomer')}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t('deliveries.searchCustomer')}
                      </span>
                    )}
                  </div>
                  {customerDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-xl max-h-60 overflow-y-auto">
                      <div className="p-2">
                        <Input
                          placeholder={t('deliveries.searchCustomer')}
                          value={customerSearch}
                          size="sm"
                          variant="bordered"
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            onCustomerSearchChange(e.target.value)
                          }
                          autoFocus
                        />
                      </div>
                      <div
                        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/50 text-sm border-b border-border"
                        onClick={selectNewCustomer}
                      >
                        <UserPlus className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-foreground">
                          {t('deliveries.newCustomer')}
                        </span>
                        {isNewCustomer && !selectedCustomer && (
                          <Check className="h-4 w-4 ms-auto text-primary" />
                        )}
                      </div>
                      {customers && customers.length > 0 ? (
                        customers.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm"
                            onClick={() => selectCustomer(c)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground truncate">{c.name}</div>
                              <div className="text-xs text-muted-foreground font-data">
                                {c.phone}
                              </div>
                            </div>
                            {selectedCustomer?.id === c.id && (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {t('deliveries.noCustomersFound')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('deliveries.customerName')}
                  size="sm"
                  variant="bordered"
                  {...register('customer_name')}
                  isInvalid={!!errors.customer_name}
                  errorMessage={errors.customer_name?.message}
                />
                <Input
                  label={t('deliveries.phone')}
                  size="sm"
                  variant="bordered"
                  {...register('phone')}
                  isInvalid={!!errors.phone}
                  errorMessage={errors.phone?.message}
                />
              </div>
              <Textarea
                label={t('deliveries.address')}
                size="sm"
                variant="bordered"
                minRows={2}
                {...register('address')}
                isInvalid={!!errors.address}
                errorMessage={errors.address?.message}
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
                    onClick={onOpenCompaniesDialog}
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
                    onClick={() => append({ product_id: 0, quantity: 1 })}
                  >
                    {t('deliveries.addItem')}
                  </Button>
                </div>
                {errors.items?.root && (
                  <p className="text-xs text-danger">{errors.items.root.message}</p>
                )}
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-center">
                      <div className="flex-1">
                        <select
                          {...register(`items.${index}.product_id`)}
                          className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-data text-foreground"
                        >
                          <option value="">{t('deliveries.selectProduct')}</option>
                          {products?.map((p) => (
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
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="border-t border-border/50">
              <Button variant="flat" size="sm" onClick={() => onOpenChange(false)}>
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
