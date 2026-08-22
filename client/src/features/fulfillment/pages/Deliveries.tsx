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
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Select,
  SelectItem,
  Card,
  CardBody,
} from '@heroui/react';
import { DataTable, StatusBadge, PageHeader, StatCard } from '../../../shared';
import DeliveryFormDialog from '../components/delivery/DeliveryFormDialog';
import DeliveryTimelineDialog from '../components/delivery/DeliveryTimelineDialog';
import ShippingCompaniesDialog from '../components/delivery/ShippingCompaniesDialog';
import { formatDateTime, formatCurrency } from '../../../shared/lib/utils';
import { useAuthStore } from '../../auth';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useProductCatalog } from '../../../shared/hooks/useProductCatalog';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';

import type { ColumnDef } from '@tanstack/react-table';
import type { Customer } from '../../../shared/types/index';
import type {
  DeliveryOrder,
  DeliveryPayload,
  DeliveryPerformance,
  DeliveryStatusHistoryEntry,
  ShippingCompany,
} from '../types';

const deliveries = resource<DeliveryOrder>('delivery');

const statuses = ['All', 'Pending', 'Shipped', 'Delivered', 'Cancelled'];

export default function Deliveries() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';

  const statusLabelMap: Record<string, string> = {
    All: t('common.all'),
    Pending: t('deliveries.pending'),
    Shipped: t('deliveries.shipped'),
    Delivered: t('deliveries.delivered'),
    Cancelled: t('deliveries.cancelled'),
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<DeliveryOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [customerSearch, setCustomerSearch] = useState('');
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [timelineOrderId, setTimelineOrderId] = useState<number | null>(null);
  const [timelineOrderNumber, setTimelineOrderNumber] = useState('');
  const [companiesDialogOpen, setCompaniesDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);

  const { data: orders, isLoading } = deliveries.useList({
    limit: 100,
    status: statusFilter === 'All' ? undefined : statusFilter,
  });

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

  const {
    products,
    hasNextPage: hasMoreProducts,
    fetchNextPage: loadMoreProducts,
    isFetchingNextPage: isLoadingMoreProducts,
  } = useProductCatalog({ search: debouncedProductSearch, enabled: isAdmin && dialogOpen });
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

  const updateStatus = deliveries.useAction('status', {
    method: 'PUT',
    message: t('deliveries.statusUpdated'),
    fallbackMessage: t('deliveries.statusUpdateFailed'),
  });

  const openCreateDialog = () => {
    setEditingOrder(null);
    setProductSearch('');
    setDialogOpen(true);
  };

  const openEditDialog = (order: DeliveryOrder) => {
    setEditingOrder(order);
    setDialogOpen(true);
  };

  const handleStatusChange = (orderId: number, status: string) => {
    updateStatus.run({ id: orderId, status });
  };

  const handleCopyCustomerInfo = (order: DeliveryOrder) => {
    const text = [
      order.customer_name,
      order.customer_phone,
      order.address,
      order.city ? `${order.city}` : '',
      order.cod_amount ? `COD: ${formatCurrency(order.cod_amount)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text).then(
      () => toast.success(t('deliveries.copied')),
      () => toast.error(t('deliveries.copyFailed'))
    );
  };

  const columns: ColumnDef<DeliveryOrder>[] = [
    {
      accessorKey: 'order_number',
      header: t('deliveries.orderNumber'),
      cell: ({ getValue }) => (
        <span className="font-data font-semibold text-primary">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'customer_name',
      header: t('deliveries.customer'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.customer_name}</p>
          <p className="text-xs text-muted-foreground">{row.original.customer_phone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'address',
      header: t('deliveries.address'),
      cell: ({ row }) => (
        <div className="max-w-xs">
          <p className="text-foreground truncate">{row.original.address}</p>
          {row.original.city && (
            <p className="text-xs text-muted-foreground">{row.original.city}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'shipping_company_name',
      header: t('deliveries.shippingCompany'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{(getValue() as string) || '-'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('common.status') || t('deliveries.status'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={row.original.status} showDot />
          {isAdmin &&
            row.original.status !== 'Delivered' &&
            row.original.status !== 'Cancelled' && (
              <Select
                size="sm"
                variant="bordered"
                aria-label="Change status"
                selectedKeys={[row.original.status]}
                className="w-32"
                onChange={(e) => {
                  const status = e.target.value;
                  if (!status) return;
                  updateStatus.run(
                    { id: row.original.id, body: { status } },
                    { onSuccess: () => toast.success(t('deliveries.statusUpdated', { status })) }
                  );
                }}
              >
                {statuses
                  .filter((s) => s !== 'All')
                  .map((s) => (
                    <SelectItem key={s} textValue={statusLabelMap[s] || s}>
                      {statusLabelMap[s] || s}
                    </SelectItem>
                  ))}
              </Select>
            )}
        </div>
      ),
    },
    {
      accessorKey: 'cod_amount',
      header: t('deliveries.codAmount'),
      cell: ({ getValue }) => (
        <span className="font-data font-medium text-foreground">
          {getValue() ? formatCurrency(getValue() as number) : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('deliveries.date'),
      cell: ({ getValue }) => (
        <span className="font-data text-xs text-muted-foreground">
          {formatDateTime(getValue() as string)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly variant="light" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label={t('common.actions')}>
            <DropdownItem
              key="edit"
              startContent={<MoreHorizontal className="h-4 w-4" />}
              onPress={() => openEditDialog(row.original)}
            >
              {t('common.edit')}
            </DropdownItem>
            <DropdownItem
              key="copy"
              startContent={<Copy className="h-4 w-4" />}
              onPress={() => handleCopyCustomerInfo(row.original)}
            >
              {t('deliveries.copyInfo')}
            </DropdownItem>
            <DropdownItem
              key="timeline"
              startContent={<History className="h-4 w-4" />}
              onPress={() => {
                setTimelineOrderId(row.original.id);
                setTimelineOrderNumber(row.original.order_number);
                setTimelineDialogOpen(true);
              }}
            >
              {t('deliveries.viewTimeline')}
            </DropdownItem>
            <DropdownItem
              key="status-pending"
              onPress={() => handleStatusChange(row.original.id, 'Pending')}
            >
              {t('deliveries.markPending')}
            </DropdownItem>
            <DropdownItem
              key="status-shipped"
              onPress={() => handleStatusChange(row.original.id, 'Shipped')}
            >
              {t('deliveries.markShipped')}
            </DropdownItem>
            <DropdownItem
              key="status-delivered"
              onPress={() => handleStatusChange(row.original.id, 'Delivered')}
            >
              {t('deliveries.markDelivered')}
            </DropdownItem>
            <DropdownItem
              key="status-cancelled"
              className="text-danger"
              color="danger"
              onPress={() => handleStatusChange(row.original.id, 'Cancelled')}
            >
              {t('deliveries.markCancelled')}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('deliveries.title')}
        actions={
          isAdmin ? (
            <Button
              color="primary"
              size="sm"
              startContent={<Plus className="h-4 w-4" />}
              onClick={openCreateDialog}
            >
              {t('deliveries.newOrder')}
            </Button>
          ) : undefined
        }
      />

      {/* Performance metrics (Admin only) */}
      {isAdmin && performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title={t('deliveries.totalDelivered')}
            value={performance.totalDelivered}
            icon={Truck}
          />
          <StatCard
            title={t('deliveries.avgDeliveryTime')}
            value={t('deliveries.days', { count: performance.avgDeliveryDays })}
            icon={Clock}
          />
          <StatCard
            title={t('deliveries.pendingOrders')}
            value={performance.pendingCount}
            icon={Package}
          />
          <StatCard
            title={t('deliveries.shippedOrders')}
            value={performance.shippedCount}
            icon={TrendingUp}
          />
        </div>
      )}

      {/* Company stats */}
      {isAdmin && performance && performance.companyStats.length > 0 && (
        <Card className="border border-border bg-card shadow-sm">
          <CardBody className="p-4">
            <h3 className="text-sm font-semibold mb-3 text-foreground">
              {t('deliveries.companyStats')}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-start py-2 pe-4 font-medium">
                      {t('deliveries.shippingCompany')}
                    </th>
                    <th className="text-start py-2 pe-4 font-medium">
                      {t('deliveries.totalOrders')}
                    </th>
                    <th className="text-start py-2 pe-4 font-medium">
                      {t('deliveries.deliveredCount')}
                    </th>
                    <th className="text-start py-2 pe-4 font-medium">
                      {t('deliveries.cancelledCount')}
                    </th>
                    <th className="text-start py-2 font-medium">{t('deliveries.avgDays')}</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.companyStats.map((cs) => (
                    <tr key={cs.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pe-4 font-medium text-foreground">{cs.name}</td>
                      <td className="py-2.5 pe-4 font-data">{cs.total_orders}</td>
                      <td className="py-2.5 pe-4 font-data text-success">{cs.delivered}</td>
                      <td className="py-2.5 pe-4 font-data text-danger">{cs.cancelled}</td>
                      <td className="py-2.5 font-data">
                        {cs.avg_days != null ? `${cs.avg_days}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'solid' : 'bordered'}
            color={statusFilter === s ? 'primary' : 'default'}
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
        productSearch={productSearch}
        onProductSearchChange={setProductSearch}
        hasMoreProducts={hasMoreProducts}
        onLoadMoreProducts={() => void loadMoreProducts()}
        isLoadingMoreProducts={isLoadingMoreProducts}
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
