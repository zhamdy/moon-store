import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Plus, Trash2, Search, UserPlus, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { useTranslation } from '../i18n';
import { t as tStandalone } from '../i18n';

const deliverySchema = z.object({
  customer_id: z.coerce.number().optional().nullable(),
  customer_name: z.string().min(1, 'Name required'),
  phone: z.string().min(1, 'Phone required'),
  address: z.string().min(1, 'Address required'),
  notes: z.string().optional(),
  assigned_to: z.coerce.number().optional().nullable(),
  items: z.array(z.object({
    product_id: z.coerce.number().positive(),
    quantity: z.coerce.number().int().positive(),
  })).min(1, 'Add at least one item'),
});

export default function Deliveries() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['deliveries', { status: statusFilter }],
    queryFn: () =>
      api.get('/api/delivery', {
        params: { limit: 100, status: statusFilter === 'All' ? undefined : statusFilter },
      }).then((r) => r.data.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products', { limit: 200 }],
    queryFn: () => api.get('/api/products', { params: { limit: 200 } }).then((r) => r.data.data),
  });

  const { data: deliveryUsers } = useQuery({
    queryKey: ['delivery-users'],
    queryFn: () => api.get('/api/users/delivery').then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () => api.get('/api/customers', { params: { search: customerSearch || undefined } }).then((r) => r.data.data),
    enabled: isAdmin && dialogOpen,
  });

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const { register, handleSubmit, control, reset, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(deliverySchema),
    defaultValues: { customer_id: null, customer_name: '', phone: '', address: '', notes: '', assigned_to: null, items: [{ product_id: '', quantity: 1 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/api/delivery', data),
    onSuccess: () => {
      toast.success(t('deliveries.orderCreated'));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDialogOpen(false);
      reset();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create order'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/api/delivery/${id}`, data),
    onSuccess: () => {
      toast.success(t('deliveries.orderUpdated'));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDialogOpen(false);
      setEditingOrder(null);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update order'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/api/delivery/${id}/status`, { status }),
    onSuccess: (res) => {
      const status = res.data.data.status;
      toast.success(t('deliveries.statusUpdated', { status }));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update status'),
  });

  const onSubmit = (data) => {
    const payload = {
      ...data,
      customer_id: selectedCustomer?.id || null,
      assigned_to: data.assigned_to || null,
      items: data.items.map((i) => ({
        product_id: parseInt(i.product_id),
        quantity: parseInt(i.quantity),
      })),
    };

    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreateDialog = () => {
    setEditingOrder(null);
    setSelectedCustomer(null);
    setIsNewCustomer(true);
    setCustomerSearch('');
    reset({ customer_id: null, customer_name: '', phone: '', address: '', notes: '', assigned_to: null, items: [{ product_id: '', quantity: 1 }] });
    setDialogOpen(true);
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setIsNewCustomer(false);
    setCustomerDropdownOpen(false);
    setCustomerSearch('');
    setValue('customer_name', customer.name);
    setValue('phone', customer.phone);
    setValue('address', customer.address || '');
  };

  const selectNewCustomer = () => {
    setSelectedCustomer(null);
    setIsNewCustomer(true);
    setCustomerDropdownOpen(false);
    setCustomerSearch('');
    setValue('customer_name', '');
    setValue('phone', '');
    setValue('address', '');
  };

  const statuses = ['All', 'Pending', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];

  const statusLabelMap = {
    'All': t('common.all'),
    'Pending': t('deliveries.pending'),
    'Preparing': t('deliveries.preparing'),
    'Out for Delivery': t('deliveries.outForDelivery'),
    'Delivered': t('deliveries.delivered'),
    'Cancelled': t('deliveries.cancelled'),
  };

  const columns = [
    { accessorKey: 'order_number', header: t('deliveries.orderNumber'), cell: ({ getValue }) => (
      <span className="font-data text-gold">{getValue()}</span>
    )},
    { accessorKey: 'customer_name', header: t('deliveries.customer') },
    { accessorKey: 'phone', header: t('deliveries.phone'), cell: ({ getValue }) => (
      <span className="font-data">{getValue()}</span>
    )},
    { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <StatusBadge status={row.original.status} />
        {(isAdmin || user?.role === 'Delivery') && row.original.status !== 'Delivered' && row.original.status !== 'Cancelled' && (
          <Select
            value={row.original.status}
            onValueChange={(val) => statusMutation.mutate({ id: row.original.id, status: val })}
          >
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.filter((s) => s !== 'All').map((s) => (
                <SelectItem key={s} value={s}>{statusLabelMap[s] || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    )},
    { accessorKey: 'assigned_name', header: t('deliveries.assignedTo'), cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'created_at', header: t('deliveries.created'), cell: ({ getValue }) => (
      <span className="text-muted font-data text-xs">{formatDateTime(getValue())}</span>
    )},
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">{t('deliveries.title')}</h1>
          <div className="gold-divider mt-2" />
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            {t('deliveries.newOrder')}
          </Button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {statusLabelMap[s] || s}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        searchPlaceholder={t('deliveries.searchPlaceholder')}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOrder ? t('deliveries.editOrder') : t('deliveries.newOrderTitle')}</DialogTitle>
            <DialogDescription>{t('deliveries.fillDetails')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    <span className="truncate">{selectedCustomer.name} — {selectedCustomer.phone}</span>
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
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted text-sm border-b border-border"
                      onClick={selectNewCustomer}
                    >
                      <UserPlus className="h-4 w-4 text-gold shrink-0" />
                      <span className="font-medium">{t('deliveries.newCustomer')}</span>
                      {isNewCustomer && !selectedCustomer && <Check className="h-4 w-4 ms-auto text-gold" />}
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
                          {selectedCustomer?.id === c.id && <Check className="h-4 w-4 shrink-0 text-gold" />}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">{t('deliveries.noCustomersFound')}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('deliveries.customerName')}</Label>
                <Input {...register('customer_name')} />
                {errors.customer_name && <p className="text-xs text-destructive">{errors.customer_name.message}</p>}
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
            <div className="space-y-2">
              <Label>{t('deliveries.notes')}</Label>
              <Textarea {...register('notes')} rows={2} />
            </div>
            {isAdmin && deliveryUsers && (
              <div className="space-y-2">
                <Label>{t('deliveries.assignTo')}</Label>
                <select
                  {...register('assigned_to')}
                  className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-data text-foreground"
                >
                  <option value="">{t('deliveries.unassigned')}</option>
                  {deliveryUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Items */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>{t('deliveries.items')}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ product_id: '', quantity: 1 })}>
                  <Plus className="h-3 w-3 me-1" /> {t('deliveries.addItem')}
                </Button>
              </div>
              {errors.items?.root && <p className="text-xs text-destructive">{errors.items.root.message}</p>}
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <select
                      {...register(`items.${index}.product_id`)}
                      className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-data text-foreground"
                    >
                      <option value="">{t('deliveries.selectProduct')}</option>
                      {products?.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.stock} in stock)</option>
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingOrder ? t('common.update') : t('deliveries.createOrder')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
