import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Search, UserPlus, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { useTranslation, t as tStandalone } from '../../i18n';

import type { Product } from '@/types';
import type {
  DeliveryOrder,
  Customer,
  ShippingCompany,
  DeliveryPayload,
} from '../../hooks/useDeliveryData';

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
  onSubmit: (payload: DeliveryPayload, editingOrder: DeliveryOrder | null) => void;
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

    onSubmit(payload, editingOrder);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingOrder ? t('deliveries.editOrder') : t('deliveries.newOrderTitle')}
          </DialogTitle>
          <DialogDescription>{t('deliveries.fillDetails')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Customer selector */}
          <div className="space-y-2" ref={customerDropdownRef}>
            <Label>{t('deliveries.selectCustomer')}</Label>
            <div className="relative">
              <div
                className="flex h-10 w-full items-center rounded-md border border-border bg-surface px-3 py-2 text-sm cursor-pointer"
                onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
              >
                <Search className="h-4 w-4 me-2 text-muted-foreground shrink-0" />
                {selectedCustomer ? (
                  <span className="truncate">
                    {selectedCustomer.name} — {selectedCustomer.phone}
                  </span>
                ) : isNewCustomer ? (
                  <span className="text-foreground">{t('deliveries.newCustomer')}</span>
                ) : (
                  <span className="text-muted-foreground">{t('deliveries.searchCustomer')}</span>
                )}
              </div>
              {customerDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-surface shadow-lg max-h-60 overflow-y-auto">
                  <div className="p-2">
                    <Input
                      placeholder={t('deliveries.searchCustomer')}
                      value={customerSearch}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        onCustomerSearchChange(e.target.value)
                      }
                      autoFocus
                    />
                  </div>
                  <div
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted text-sm border-b border-border"
                    onClick={selectNewCustomer}
                  >
                    <UserPlus className="h-4 w-4 text-gold shrink-0" />
                    <span className="font-medium">{t('deliveries.newCustomer')}</span>
                    {isNewCustomer && !selectedCustomer && (
                      <Check className="h-4 w-4 ms-auto text-gold" />
                    )}
                  </div>
                  {customers && customers.length > 0 ? (
                    customers.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted text-sm"
                        onClick={() => selectCustomer(c)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground font-data">{c.phone}</div>
                        </div>
                        {selectedCustomer?.id === c.id && (
                          <Check className="h-4 w-4 shrink-0 text-gold" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('deliveries.customerName')}</Label>
              <Input {...register('customer_name')} />
              {errors.customer_name && (
                <p className="text-xs text-destructive">{errors.customer_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('deliveries.phone')}</Label>
              <Input {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('deliveries.address')}</Label>
            <Textarea {...register('address')} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('deliveries.notes')}</Label>
              <Textarea {...register('notes')} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveries.estimatedDelivery')}</Label>
              <Input type="datetime-local" {...register('estimated_delivery')} />
            </div>
          </div>

          {/* Shipping fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('deliveries.shippingCompany')}</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={onOpenCompaniesDialog}
              >
                {t('deliveries.manageCompanies')}
              </Button>
            </div>
            <select
              {...register('shipping_company_id')}
              className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-data text-foreground"
            >
              <option value="">{t('deliveries.noCompany')}</option>
              {shippingCompanies?.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('deliveries.trackingNumber')}</Label>
              <Input {...register('tracking_number')} placeholder="e.g. 1234567890" />
            </div>
            <div className="space-y-2">
              <Label>{t('deliveries.shippingCost')}</Label>
              <Input type="number" step="0.01" min="0" {...register('shipping_cost')} />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>{t('deliveries.items')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ product_id: 0, quantity: 1 })}
              >
                <Plus className="h-3 w-3 me-1" /> {t('deliveries.addItem')}
              </Button>
            </div>
            {errors.items?.root && (
              <p className="text-xs text-destructive">{errors.items.root.message}</p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-end">
                <div className="flex-1">
                  <select
                    {...register(`items.${index}.product_id`)}
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-data text-foreground"
                  >
                    <option value="">{t('deliveries.selectProduct')}</option>
                    {products?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.stock} in stock)
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  type="number"
                  min="1"
                  {...register(`items.${index}.quantity`)}
                  className="w-20"
                />
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {editingOrder ? t('common.update') : t('deliveries.createOrder')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
