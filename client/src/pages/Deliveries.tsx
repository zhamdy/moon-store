import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Clock,
  TrendingUp,
  Truck,
  History,
  MoreHorizontal,
  Package,
  Copy,
} from 'lucide-react';
import { Button } from '../shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../shared/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/select';
import { Card, CardContent } from '../shared/ui/card';
import DataTable from '../shared/components/DataTable';
import StatusBadge from '../shared/components/StatusBadge';
import DeliveryFormDialog from '../components/delivery/DeliveryFormDialog';
import DeliveryTimelineDialog from '../components/delivery/DeliveryTimelineDialog';
import ShippingCompaniesDialog from '../components/delivery/ShippingCompaniesDialog';
import { formatDateTime, formatCurrency } from '../shared/lib/utils';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../shared/i18n/index';
import { resource } from '../shared/lib/resource';
import { useApiQuery } from '../shared/lib/apiQuery';

import type { ColumnDef } from '@tanstack/react-table';
import type {
  Customer,
  DeliveryOrder,
  DeliveryPayload,
  DeliveryPerformance,
  DeliveryStatusHistoryEntry,
  Product,
  ShippingCompany,
} from '@/types';

const deliveries = resource<DeliveryOrder>('delivery');

const statuses = ['All', 'Pending', 'Shipped', 'Delivered', 'Cancelled'];

export default function Deliveries() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<DeliveryOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [customerSearch, setCustomerSearch] = useState('');
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [timelineOrderId, setTimelineOrderId] = useState<number | null>(null);
  const [timelineOrderNumber, setTimelineOrderNumber] = useState('');
  const [companiesDialogOpen, setCompaniesDialogOpen] = useState(false);

  const { data: orders, isLoading } = deliveries.useList({
    limit: 100,
    status: statusFilter === 'All' ? undefined : statusFilter,
  });

  // Both hang off the delivery collection, so any write to it refreshes them
  // without the page naming what to invalidate.
  const { data: performance } = deliveries.useRead<DeliveryPerformance>(
    'analytics/performance',
    undefined,
    isAdmin
  );
  const { data: statusHistory } = deliveries.useRead<DeliveryStatusHistoryEntry[]>(
    `${timelineOrderId}/history`,
    undefined,
    timelineOrderId !== null && timelineDialogOpen
  );

  // Reads belonging to other collections, held back until the form that needs
  // them is showing. `useList` has no such gate, and should not grow one.
  const { data: products } = useApiQuery<Product[]>(['products', { limit: 200 }], 'products', {
    limit: 200,
  });
  const { data: customers } = useApiQuery<Customer[]>(
    ['customers', { search: customerSearch }],
    'customers',
    { search: customerSearch || undefined },
    { enabled: isAdmin && dialogOpen }
  );
  const { data: shippingCompanies } = useApiQuery<ShippingCompany[]>(
    ['shipping-companies'],
    'shipping-companies',
    undefined,
    { enabled: isAdmin }
  );

  const saveOrder = deliveries.useSave({
    message: editingOrder ? t('deliveries.orderUpdated') : t('deliveries.orderCreated'),
    fallbackMessage: editingOrder ? t('deliveries.updateFailed') : t('deliveries.createFailed'),
    onDone: () => {
      setDialogOpen(false);
      setEditingOrder(null);
    },
  });

  const changeStatus = deliveries.useAction('status', {
    method: 'PUT',
    fallbackMessage: t('deliveries.statusFailed'),
  });

  const openCreateDialog = () => {
    setEditingOrder(null);
    setCustomerSearch('');
    setDialogOpen(true);
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
                onValueChange={(status) =>
                  changeStatus.run(
                    { id: row.original.id, body: { status } },
                    // The wording names the status, which only the call site
                    // knows, so it is toasted here rather than by the hook.
                    { onSuccess: () => toast.success(t('deliveries.statusUpdated', { status })) }
                  )
                }
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t('common.actions')}
            >
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
      <DeliveryTimelineDialog
        open={timelineDialogOpen}
        onOpenChange={setTimelineDialogOpen}
        orderNumber={timelineOrderNumber}
        history={statusHistory}
      />

      {/* Manage Shipping Companies Dialog */}
      <ShippingCompaniesDialog
        open={companiesDialogOpen}
        onOpenChange={setCompaniesDialogOpen}
        companies={shippingCompanies}
      />

      {/* Create/Edit Dialog */}
      <DeliveryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingOrder={editingOrder}
        products={products}
        customers={customers}
        shippingCompanies={shippingCompanies}
        onSubmit={(payload: DeliveryPayload) =>
          saveOrder.save({ id: editingOrder?.id ?? null, ...payload })
        }
        isSubmitting={saveOrder.isSaving}
        customerSearch={customerSearch}
        onCustomerSearchChange={setCustomerSearch}
        onOpenCompaniesDialog={() => setCompaniesDialogOpen(true)}
      />
    </div>
  );
}
