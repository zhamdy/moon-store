import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus,
  Trash2,
  Search,
  UserPlus,
  Check,
  Clock,
  TrendingUp,
  Truck,
  History,
  MoreHorizontal,
  Package,
  Copy,
  Globe,
  Phone,
  Building2,
  Pencil,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { useTranslation } from '../i18n';

import type { ColumnDef } from '@tanstack/react-table';
import type { AxiosError, AxiosResponse } from 'axios';

type DeliveryStatus = 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';

interface ShippingCompany {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  created_at: string;
}

interface DeliveryOrder {
  id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string | null;
  status: DeliveryStatus;
  shipping_company_id: number | null;
  shipping_company_name: string | null;
  tracking_number: string | null;
  shipping_cost: number;
  estimated_delivery: string | null;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  price: string | number;
  stock: number;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
}

interface ApiErrorResponse {
  error: string;
}

interface StatusHistoryEntry {
  id: number;
  order_id: number;
  status: string;
  notes: string | null;
  changed_by_name: string | null;
  created_at: string;
}

interface PerformanceData {
  totalDelivered: number;
  avgDeliveryDays: number;
  pendingCount: number;
  shippedCount: number;
  companyStats: Array<{
    id: number;
    name: string;
    total_orders: number;
    delivered: number;
    cancelled: number;
    avg_days: number | null;
  }>;
}

const deliverySchema = z.object({
  customer_id: z.coerce.number().optional().nullable(),
  customer_name: z.string().min(1, 'Name required'),
  phone: z.string().min(1, 'Phone required'),
  address: z.string().min(1, 'Address required'),
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
    .min(1, 'Add at least one item'),
});

type DeliveryFormData = z.infer<typeof deliverySchema>;

interface DeliveryPayload extends Omit<DeliveryFormData, 'items'> {
  customer_id: number | null;
  shipping_company_id: number | null;
  tracking_number: string | null;
  shipping_cost: number | null;
  estimated_delivery: string | null;
  items: Array<{ product_id: number; quantity: number }>;
}

export default function Deliveries() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<DeliveryOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [timelineOrderId, setTimelineOrderId] = useState<number | null>(null);
  const [timelineOrderNumber, setTimelineOrderNumber] = useState('');
  const [companiesDialogOpen, setCompaniesDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<ShippingCompany | null>(null);
  const [companyFormOpen, setCompanyFormOpen] = useState(false);

  const { data: orders, isLoading } = useQuery<DeliveryOrder[]>({
    queryKey: ['deliveries', { status: statusFilter }],
    queryFn: () =>
      api
        .get('/api/delivery', {
          params: { limit: 100, status: statusFilter === 'All' ? undefined : statusFilter },
        })
        .then((r) => r.data.data),
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products', { limit: 200 }],
    queryFn: () => api.get('/api/products', { params: { limit: 200 } }).then((r) => r.data.data),
  });

  const { data: shippingCompanies } = useQuery<ShippingCompany[]>({
    queryKey: ['shipping-companies'],
    queryFn: () => api.get('/api/shipping-companies').then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers', { search: customerSearch }],
    queryFn: () =>
      api
        .get('/api/customers', { params: { search: customerSearch || undefined } })
        .then((r) => r.data.data),
    enabled: isAdmin && dialogOpen,
  });

  const { data: performance } = useQuery<PerformanceData>({
    queryKey: ['delivery-performance'],
    queryFn: () => api.get('/api/delivery/analytics/performance').then((r) => r.data.data),
    enabled: isAdmin,
  });

  const { data: statusHistory } = useQuery<StatusHistoryEntry[]>({
    queryKey: ['delivery-history', timelineOrderId],
    queryFn: () => api.get(`/api/delivery/${timelineOrderId}/history`).then((r) => r.data.data),
    enabled: !!timelineOrderId && timelineDialogOpen,
  });

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
    resolver: zodResolver(deliverySchema),
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

  const createMutation = useMutation({
    mutationFn: (data: DeliveryPayload) => api.post('/api/delivery', data),
    onSuccess: () => {
      toast.success(t('deliveries.orderCreated'));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-performance'] });
      setDialogOpen(false);
      reset();
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DeliveryPayload }) =>
      api.put(`/api/delivery/${id}`, data),
    onSuccess: () => {
      toast.success(t('deliveries.orderUpdated'));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-performance'] });
      setDialogOpen(false);
      setEditingOrder(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.updateFailed')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/delivery/${id}/status`, { status }),
    onSuccess: (res: AxiosResponse<{ data: { status: string } }>) => {
      const status = res.data.data.status;
      toast.success(t('deliveries.statusUpdated', { status }));
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-performance'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-history'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.statusFailed')),
  });

  // Shipping company mutations
  const companyCreateMutation = useMutation({
    mutationFn: (data: { name: string; phone?: string; website?: string }) =>
      api.post('/api/shipping-companies', data),
    onSuccess: () => {
      toast.success(t('deliveries.companySaved'));
      queryClient.invalidateQueries({ queryKey: ['shipping-companies'] });
      setCompanyFormOpen(false);
      setEditingCompany(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.createFailed')),
  });

  const companyUpdateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; phone?: string; website?: string };
    }) => api.put(`/api/shipping-companies/${id}`, data),
    onSuccess: () => {
      toast.success(t('deliveries.companySaved'));
      queryClient.invalidateQueries({ queryKey: ['shipping-companies'] });
      setCompanyFormOpen(false);
      setEditingCompany(null);
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.updateFailed')),
  });

  const companyDeleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/shipping-companies/${id}`),
    onSuccess: () => {
      toast.success(t('deliveries.companyDeleted'));
      queryClient.invalidateQueries({ queryKey: ['shipping-companies'] });
    },
    onError: (err: AxiosError<ApiErrorResponse>) =>
      toast.error(err.response?.data?.error || t('deliveries.companyDeleteFailed')),
  });

  const onSubmit = (data: DeliveryFormData) => {
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
    setDialogOpen(true);
  };

  const selectCustomer = (customer: Customer) => {
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

  const openTimeline = (order: DeliveryOrder) => {
    setTimelineOrderId(order.id);
    setTimelineOrderNumber(order.order_number);
    setTimelineDialogOpen(true);
  };

  const copyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    toast.success(t('deliveries.copyTracking'));
  };

  const statuses = ['All', 'Pending', 'Shipped', 'Delivered', 'Cancelled'];

  const statusLabelMap: Record<string, string> = {
    All: t('common.all'),
    Pending: t('deliveries.pending'),
    Shipped: t('deliveries.shipped'),
    Delivered: t('deliveries.delivered'),
    Cancelled: t('deliveries.cancelled'),
  };

  const columns: ColumnDef<DeliveryOrder>[] = [
    {
      accessorKey: 'order_number',
      header: t('deliveries.orderNumber'),
      cell: ({ getValue }) => <span className="font-data text-gold">{getValue() as string}</span>,
    },
    { accessorKey: 'customer_name', header: t('deliveries.customer') },
    {
      accessorKey: 'phone',
      header: t('deliveries.phone'),
      cell: ({ getValue }) => <span className="font-data">{getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={row.original.status} />
          {isAdmin &&
            row.original.status !== 'Delivered' &&
            row.original.status !== 'Cancelled' && (
              <Select
                value={row.original.status}
                onValueChange={(val) => statusMutation.mutate({ id: row.original.id, status: val })}
              >
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses
                    .filter((s) => s !== 'All')
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabelMap[s] || s}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
        </div>
      ),
    },
    {
      accessorKey: 'shipping_company_name',
      header: t('deliveries.shippingCompany'),
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
    {
      accessorKey: 'tracking_number',
      header: t('deliveries.trackingNumber'),
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        if (!val) return '-';
        return (
          <div className="flex items-center gap-1">
            <span className="font-data text-xs">{val}</span>
            <button
              onClick={() => copyTracking(val)}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        );
      },
    },
    {
      accessorKey: 'shipping_cost',
      header: t('deliveries.shippingCost'),
      cell: ({ getValue }) => {
        const val = getValue() as number;
        return val ? <span className="font-data">{formatCurrency(val)}</span> : '-';
      },
    },
    {
      accessorKey: 'created_at',
      header: t('deliveries.created'),
      cell: ({ getValue }) => (
        <span className="text-muted font-data text-xs">{formatDateTime(getValue() as string)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openTimeline(row.original)}>
              <History className="h-4 w-4 me-2" />
              {t('deliveries.viewTimeline')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('deliveries.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            {t('deliveries.newOrder')}
          </Button>
        )}
      </div>

      {/* Performance metrics (Admin only) */}
      {isAdmin && performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <Truck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('deliveries.totalDelivered')}</p>
                <p className="text-xl font-bold font-data">{performance.totalDelivered}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('deliveries.avgDeliveryTime')}</p>
                <p className="text-xl font-bold font-data">
                  {t('deliveries.days', { count: performance.avgDeliveryDays })}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/10">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('deliveries.pendingOrders')}</p>
                <p className="text-xl font-bold font-data">{performance.pendingCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('deliveries.shippedOrders')}</p>
                <p className="text-xl font-bold font-data">{performance.shippedCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Company stats */}
      {isAdmin && performance && performance.companyStats.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">{t('deliveries.companyStats')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start py-2 pe-4 text-muted-foreground font-medium">
                      {t('deliveries.shippingCompany')}
                    </th>
                    <th className="text-start py-2 pe-4 text-muted-foreground font-medium">
                      {t('deliveries.totalOrders')}
                    </th>
                    <th className="text-start py-2 pe-4 text-muted-foreground font-medium">
                      {t('deliveries.deliveredCount')}
                    </th>
                    <th className="text-start py-2 pe-4 text-muted-foreground font-medium">
                      {t('deliveries.cancelledCount')}
                    </th>
                    <th className="text-start py-2 text-muted-foreground font-medium">
                      {t('deliveries.avgDays')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {performance.companyStats.map((cs) => (
                    <tr key={cs.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pe-4 font-medium">{cs.name}</td>
                      <td className="py-2 pe-4 font-data">{cs.total_orders}</td>
                      <td className="py-2 pe-4 font-data text-green-600">{cs.delivered}</td>
                      <td className="py-2 pe-4 font-data text-destructive">{cs.cancelled}</td>
                      <td className="py-2 font-data">
                        {cs.avg_days != null ? `${cs.avg_days}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
        data={orders ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('deliveries.searchPlaceholder')}
      />

      {/* Timeline Dialog */}
      <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('deliveries.statusTimeline')} — {timelineOrderNumber}
            </DialogTitle>
            <DialogDescription>{t('deliveries.statusTimeline')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-0">
            {statusHistory && statusHistory.length > 0 ? (
              <div className="relative ps-6">
                <div className="absolute start-[11px] top-2 bottom-2 w-0.5 bg-border" />
                {statusHistory.map((entry, idx) => {
                  const isLast = idx === statusHistory.length - 1;
                  const isCancelled = entry.status === 'Cancelled';
                  return (
                    <div key={entry.id} className="relative pb-6 last:pb-0">
                      <div
                        className={`absolute start-[-13px] top-1 h-3 w-3 rounded-full border-2 ${
                          isCancelled
                            ? 'border-destructive bg-destructive'
                            : isLast
                              ? 'border-gold bg-gold'
                              : 'border-muted-foreground bg-muted-foreground'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={entry.status} />
                          <span className="text-xs text-muted-foreground font-data">
                            {formatDateTime(entry.created_at)}
                          </span>
                        </div>
                        {entry.changed_by_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by {entry.changed_by_name}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="text-sm mt-1 text-foreground/80">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('common.noResults')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Shipping Companies Dialog */}
      <Dialog open={companiesDialogOpen} onOpenChange={setCompaniesDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('deliveries.manageCompanies')}
            </DialogTitle>
            <DialogDescription>{t('deliveries.manageCompanies')}</DialogDescription>
          </DialogHeader>

          {companyFormOpen ? (
            <CompanyForm
              company={editingCompany}
              onSave={(data) => {
                if (editingCompany) {
                  companyUpdateMutation.mutate({ id: editingCompany.id, data });
                } else {
                  companyCreateMutation.mutate(data);
                }
              }}
              onCancel={() => {
                setCompanyFormOpen(false);
                setEditingCompany(null);
              }}
              isPending={companyCreateMutation.isPending || companyUpdateMutation.isPending}
              t={t}
            />
          ) : (
            <div className="space-y-2">
              <Button
                size="sm"
                className="gap-1 w-full"
                onClick={() => {
                  setEditingCompany(null);
                  setCompanyFormOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('deliveries.addCompany')}
              </Button>
              {shippingCompanies && shippingCompanies.length > 0 ? (
                shippingCompanies.map((sc) => (
                  <div
                    key={sc.id}
                    className="flex items-center justify-between p-3 rounded-md border border-border"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{sc.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {sc.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {sc.phone}
                          </span>
                        )}
                        {sc.website && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" /> {sc.website}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingCompany(sc);
                          setCompanyFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => companyDeleteMutation.mutate(sc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t('common.noResults')}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingOrder ? t('deliveries.editOrder') : t('deliveries.newOrderTitle')}
            </DialogTitle>
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
                          setCustomerSearch(e.target.value)
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
              {errors.address && (
                <p className="text-xs text-destructive">{errors.address.message}</p>
              )}
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
                  onClick={() => setCompaniesDialogOpen(true)}
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

// Sub-component for company add/edit form
function CompanyForm({
  company,
  onSave,
  onCancel,
  isPending,
  t,
}: {
  company: ShippingCompany | null;
  onSave: (data: { name: string; phone?: string; website?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
  t: (key: string) => string;
}) {
  const [name, setName] = useState(company?.name || '');
  const [phone, setPhone] = useState(company?.phone || '');
  const [website, setWebsite] = useState(company?.website || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      phone: phone.trim() || undefined,
      website: website.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label>{t('deliveries.companyName')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>{t('deliveries.companyPhone')}</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t('deliveries.companyWebsite')}</Label>
        <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
