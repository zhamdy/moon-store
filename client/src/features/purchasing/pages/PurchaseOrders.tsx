import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Send, PackageCheck, Trash2, X, Eye, Wand2 } from 'lucide-react';
import { Button, Select, SelectItem } from '@heroui/react';
import { Badge, PageHeader, ConfirmDialog, DataTable } from '../../../shared';
import POFormDialog from '../components/purchase-orders/POFormDialog';
import PODetailDialog from '../components/purchase-orders/PODetailDialog';
import { formatCurrency } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useProductCatalog } from '../../../shared/hooks/useProductCatalog';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useTransport } from '../../../shared/lib/transport/index';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import type { PaginationMeta } from '../../../shared/lib/transport/types';
import type { Distributor } from '../../../shared/types/index';
import type {
  LowStockSuggestion,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderLine,
} from '../types';

const purchaseOrders = resource<PurchaseOrder>('purchase-orders');
const purchaseOrderDetails = resource<PurchaseOrderDetail>('purchase-orders');
const distributorsResource = resource<Distributor>('distributors');

export default function PurchaseOrders() {
  const { t } = useTranslation();
  const transport = useTransport();

  const [statusFilter, setStatusFilter] = useState('All');
  const [distributorFilter, setDistributorFilter] = useState('all');

  // Create PO state
  const [createOpen, setCreateOpen] = useState(false);
  const [autoDistributorId, setAutoDistributorId] = useState('');
  const [autoLineItems, setAutoLineItems] = useState<PurchaseOrderLine[] | undefined>(undefined);
  // Key forces POFormDialog remount when auto-generate populates initial data
  const [formKey, setFormKey] = useState(0);
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);

  // Detail/Receive dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [initialReceiveMode, setInitialReceiveMode] = useState(false);

  // Delete/Cancel confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const {
    data: orders,
    meta,
    isLoading,
    isFetching,
  } = purchaseOrders.useList({
    page,
    pageSize,
    status: statusFilter === 'All' ? undefined : statusFilter,
    distributorId: distributorFilter === 'all' ? undefined : distributorFilter,
  });
  const pageMeta = meta?.pagination as PaginationMeta | undefined;
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };

  const { data: detail } = purchaseOrderDetails.useOne(detailOpen ? detailId : null);
  const { data: distributors } = distributorsResource.useList();

  const {
    products,
    hasNextPage: hasMoreProducts,
    fetchNextPage: loadMoreProducts,
    isFetchingNextPage: isLoadingMoreProducts,
  } = useProductCatalog({
    search: debouncedProductSearch,
    enabled: createOpen,
    selectedIds: autoLineItems?.map((item) => item.product_id) ?? [],
  });

  const createOrder = purchaseOrders.useSave({
    message: t('po.created'),
    fallbackMessage: t('po.createFailed'),
    onDone: () => {
      setCreateOpen(false);
      setAutoDistributorId('');
      setAutoLineItems(undefined);
    },
  });

  const changeStatus = purchaseOrders.useAction('status', {
    method: 'PUT',
    message: t('po.statusUpdated'),
  });

  const receiveItems = purchaseOrders.useAction('receive', {
    message: t('po.received_success'),
    fallbackMessage: t('po.receiveFailed'),
    onDone: () => setInitialReceiveMode(false),
  });

  const deleteOrder = purchaseOrders.useRemove({
    message: t('po.deleted'),
    fallbackMessage: t('po.deleteFailed'),
    onDone: () => setDeleteId(null),
  });

  const handleAutoGenerate = async () => {
    try {
      const { data: suggestions } = await transport.request<LowStockSuggestion[]>({
        method: 'GET',
        path: 'purchase-orders/auto-generate',
      });
      if (suggestions.length === 0) {
        toast.error(t('po.autoGenerateEmpty'));
        return;
      }
      // Group by first distributor and pre-fill
      const firstDist = suggestions[0].distributor_id;
      const distItems = suggestions.filter((s) => s.distributor_id === firstDist);
      setAutoDistributorId(String(firstDist));
      setAutoLineItems(
        distItems.map((s) => ({
          product_id: s.product_id,
          product_name: s.name,
          quantity: Math.max(s.suggested_qty, 1),
          cost_price: s.cost_price || 0,
        }))
      );
      setFormKey((k) => k + 1);
      setCreateOpen(true);
    } catch {
      toast.error(t('po.createFailed'));
    }
  };

  const handleCreateOpen = () => {
    setAutoDistributorId('');
    setAutoLineItems(undefined);
    setFormKey((k) => k + 1);
    setProductSearch('');
    setCreateOpen(true);
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'Draft':
        return (
          <Badge size="sm" variant="default">
            {t('po.draft')}
          </Badge>
        );
      case 'Sent':
        return (
          <Badge size="sm" variant="primary">
            {t('po.sent')}
          </Badge>
        );
      case 'Partially Received':
        return (
          <Badge size="sm" variant="warning">
            {t('po.partiallyReceived')}
          </Badge>
        );
      case 'Received':
        return (
          <Badge size="sm" variant="success">
            {t('po.fullyReceived')}
          </Badge>
        );
      case 'Cancelled':
        return (
          <Badge size="sm" variant="danger">
            {t('po.cancelled')}
          </Badge>
        );
      default:
        return (
          <Badge size="sm" variant="default">
            {status}
          </Badge>
        );
    }
  };

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: 'po_number',
      header: t('po.poNumber'),
      cell: ({ getValue }) => (
        <span className="font-data font-semibold text-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'distributor_name',
      header: t('po.distributor'),
    },
    {
      accessorKey: 'status',
      header: t('po.status'),
      cell: ({ getValue }) => getStatusChip(getValue() as string),
    },
    {
      accessorKey: 'total',
      header: t('po.total'),
      cell: ({ getValue }) => (
        <span className="font-data font-semibold text-primary">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'item_count',
      header: t('po.items'),
      cell: ({ getValue }) => (
        <span className="font-data text-foreground">{getValue() as number}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('po.createdAt'),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(getValue() as string).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      enableSorting: false,
      cell: ({ row }) => {
        const po = row.original;
        return (
          <div className="flex gap-1">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8"
              title={t('po.viewDetails')}
              onClick={() => {
                setDetailId(po.id);
                setDetailOpen(true);
                setInitialReceiveMode(false);
              }}
              aria-label={t('po.viewDetails')}
            >
              <Eye className="h-3.5 w-3.5 text-primary" />
            </Button>
            {po.status === 'Draft' && (
              <Button
                isIconOnly
                variant="light"
                size="sm"
                className="h-8 w-8"
                title={t('po.markSent')}
                onClick={() => changeStatus.run({ id: po.id, body: { status: 'Sent' } })}
                aria-label={t('po.markSent')}
              >
                <Send className="h-3.5 w-3.5 text-primary" />
              </Button>
            )}
            {(po.status === 'Sent' || po.status === 'Partially Received') && (
              <Button
                isIconOnly
                variant="light"
                size="sm"
                className="h-8 w-8"
                title={t('po.receive')}
                onClick={() => {
                  setDetailId(po.id);
                  setDetailOpen(true);
                  setInitialReceiveMode(true);
                }}
                aria-label={t('po.receive')}
              >
                <PackageCheck className="h-3.5 w-3.5 text-success" />
              </Button>
            )}
            {po.status !== 'Received' && po.status !== 'Cancelled' && (
              <Button
                isIconOnly
                variant="light"
                size="sm"
                className="h-8 w-8"
                title={t('po.cancel')}
                onClick={() => setCancelId(po.id)}
                aria-label={t('po.cancel')}
              >
                <X className="h-3.5 w-3.5 text-warning" />
              </Button>
            )}
            {po.status === 'Draft' && (
              <Button
                isIconOnly
                variant="light"
                color="danger"
                size="sm"
                className="h-8 w-8"
                title={t('po.delete')}
                onClick={() => setDeleteId(po.id)}
                aria-label={t('po.delete')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('po.title')}
        actions={
          <div className="flex gap-2">
            <Button
              variant="bordered"
              size="sm"
              className="gap-2"
              onClick={handleAutoGenerate}
              startContent={<Wand2 className="h-4 w-4 text-primary" />}
            >
              {t('po.autoGenerate')}
            </Button>
            <Button
              color="primary"
              size="sm"
              className="gap-2"
              onClick={handleCreateOpen}
              startContent={<Plus className="h-4 w-4" />}
            >
              {t('po.create')}
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-48">
          <Select
            label={t('po.status')}
            size="sm"
            variant="bordered"
            selectedKeys={[statusFilter]}
            onChange={(e) => {
              setStatusFilter(e.target.value || 'All');
              setPage(1);
            }}
          >
            <SelectItem key="All" textValue={t('po.allStatuses')}>
              {t('po.allStatuses')}
            </SelectItem>
            <SelectItem key="Draft" textValue={t('po.draft')}>
              {t('po.draft')}
            </SelectItem>
            <SelectItem key="Sent" textValue={t('po.sent')}>
              {t('po.sent')}
            </SelectItem>
            <SelectItem key="Partially Received" textValue={t('po.partiallyReceived')}>
              {t('po.partiallyReceived')}
            </SelectItem>
            <SelectItem key="Received" textValue={t('po.fullyReceived')}>
              {t('po.fullyReceived')}
            </SelectItem>
            <SelectItem key="Cancelled" textValue={t('po.cancelled')}>
              {t('po.cancelled')}
            </SelectItem>
          </Select>
        </div>

        <div className="w-48">
          <Select
            label={t('po.distributor')}
            size="sm"
            variant="bordered"
            selectedKeys={[distributorFilter]}
            onChange={(e) => {
              setDistributorFilter(e.target.value || 'all');
              setPage(1);
            }}
          >
            <SelectItem key="all" textValue={t('po.allDistributors')}>
              {t('po.allDistributors')}
            </SelectItem>
            {(distributors ?? []).map((d) => (
              <SelectItem key={String(d.id)} textValue={d.name}>
                {d.name}
              </SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <DataTable
        mode="server"
        columns={columns}
        data={orders ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        pagination={pagination}
        pageCount={pageMeta?.totalPages ?? 0}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          setPage(next.pageIndex + 1);
          setPageSize(next.pageSize);
        }}
        searchPlaceholder={t('common.search')}
      />

      {/* Create PO Dialog */}
      <POFormDialog
        key={formKey}
        open={createOpen}
        onOpenChange={setCreateOpen}
        distributors={distributors}
        products={products}
        productSearch={productSearch}
        onProductSearchChange={setProductSearch}
        hasMoreProducts={hasMoreProducts}
        onLoadMoreProducts={() => void loadMoreProducts()}
        isLoadingMoreProducts={isLoadingMoreProducts}
        onSubmit={(data) => createOrder.save(data)}
        isSubmitting={createOrder.isSaving}
        initialDistributorId={autoDistributorId}
        initialLineItems={autoLineItems}
      />

      {/* Detail / Receive Dialog */}
      <PODetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailId(null);
            setInitialReceiveMode(false);
          }
        }}
        detail={detail}
        onReceive={(items) => {
          if (!detailId) return;
          receiveItems.run({ id: detailId, body: { items } });
        }}
        isReceiving={receiveItems.isRunning}
        initialReceiveMode={initialReceiveMode}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t('po.delete')}
        description={t('po.deleteConfirm')}
        confirmText={t('common.delete')}
        confirmColor="danger"
        isLoading={deleteOrder.isRemoving}
        onConfirm={() => deleteId && deleteOrder.remove(deleteId)}
      />

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
        title={t('po.cancel')}
        description={t('po.cancelConfirm')}
        confirmText={t('po.cancel')}
        confirmColor="warning"
        isLoading={changeStatus.isRunning}
        onConfirm={() => {
          if (cancelId) {
            changeStatus.run({ id: cancelId, body: { status: 'Cancelled' } });
            setCancelId(null);
          }
        }}
      />
    </div>
  );
}
