import { useState } from 'react';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Eye, Truck, XCircle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../../shared/lib/utils';
import { Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { Badge, type BadgeVariant, PageHeader, DataTable } from '../../../shared';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useListRouteState, useLastPageRecovery } from '../../../shared/hooks/useListRouteState';
import type { OnlineOrder } from '../types';
import type { PaginationMeta } from '../../../shared/lib/transport/types';

const onlineOrders = resource<OnlineOrder>('online-orders');

const statusVariantMap: Record<string, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'primary',
  processing: 'secondary',
  shipped: 'primary',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'default',
};

export default function OnlineOrdersPage() {
  const { t } = useTranslation();
  const { search: routeSearch, page, pageSize, update } = useListRouteState();
  const statusFilter = typeof routeSearch.status === 'string' ? routeSearch.status : '';
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const {
    data: orders,
    meta,
    isLoading,
    isFetching,
    error,
    refetch,
  } = onlineOrders.useList({ page, pageSize, status: statusFilter || undefined });
  const pageMeta = meta?.pagination as PaginationMeta | undefined;
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };

  useLastPageRecovery(page, pageMeta?.totalItems, pageMeta?.totalPages, update);
  const { data: selectedOrder } = onlineOrders.useOne(detailOpen ? detailId : null);

  const updateStatus = onlineOrders.useAction('status', {
    method: 'PUT',
    message: t('onlineOrders.statusUpdated'),
    onDone: () => setDetailOpen(false),
  });

  const viewOrder = (id: number) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const fmt = (n: number) => formatCurrency(n);
  const statuses = ['', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  const columns: ColumnDef<OnlineOrder>[] = [
    {
      accessorKey: 'order_number',
      header: t('onlineOrders.orderNumber'),
      cell: ({ getValue }) => (
        <span className="font-medium font-data text-primary">#{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'customer_name',
      header: t('onlineOrders.customer'),
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground">{(getValue() as string) || '—'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('common.status'),
      cell: ({ row }) => (
        <Badge size="sm" variant={statusVariantMap[row.original.status] || 'default'}>
          {t(`onlineOrders.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      accessorKey: 'payment_status',
      header: t('onlineOrders.payment'),
      cell: ({ getValue }) => (
        <Badge size="sm" variant={getValue() === 'paid' ? 'success' : 'default'}>
          {getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: 'total',
      header: t('onlineOrders.total'),
      cell: ({ getValue }) => (
        <span className="font-data font-semibold text-foreground">{fmt(getValue() as number)}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('common.date'),
      cell: ({ getValue }) => (
        <span className="font-data text-muted-foreground text-xs">
          {new Date(getValue() as string).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onPress={() => viewOrder(row.original.id)}
          aria-label="View order"
        >
          <Eye className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('onlineOrders.title')} />

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'solid' : 'bordered'}
            color={statusFilter === s ? 'primary' : 'default'}
            size="sm"
            onPress={() => {
              update({ status: s || undefined, page: 1 });
            }}
          >
            {s ? t(`onlineOrders.${s}`) : t('common.all')}
          </Button>
        ))}
      </div>

      <DataTable
        mode="server"
        columns={columns}
        data={orders ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
        pagination={pagination}
        pageCount={pageMeta?.totalPages ?? 0}
        totalRows={pageMeta?.totalItems ?? 0}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          update({
            page: next.pageSize === pageSize ? next.pageIndex + 1 : 1,
            pageSize: next.pageSize,
          });
        }}
        searchPlaceholder={t('common.search')}
      />

      <Modal
        isOpen={detailOpen}
        onOpenChange={setDetailOpen}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: 'bg-card text-card-foreground border border-border shadow-xl',
        }}
      >
        <ModalContent>
          {() => (
            <div>
              <ModalHeader className="border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold">
                    {t('onlineOrders.orderDetails')} — #{selectedOrder?.order_number}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">
                    {t('onlineOrders.manageOrder')}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="py-4 space-y-4">
                {selectedOrder && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Badge
                        size="sm"
                        variant={statusVariantMap[selectedOrder.status] || 'default'}
                      >
                        {t(`onlineOrders.${selectedOrder.status}`)}
                      </Badge>
                      <span className="text-base font-bold font-data text-foreground">
                        {fmt(selectedOrder.total)}
                      </span>
                    </div>
                    {selectedOrder.items && (
                      <div className="border divide-y rounded-lg border-border divide-border/50 bg-muted/20">
                        {selectedOrder.items.map((item) => (
                          <div key={item.id} className="flex justify-between p-3 text-sm">
                            <span className="font-medium text-foreground">
                              {item.product_name}{' '}
                              <span className="text-muted-foreground font-normal">
                                x{item.quantity}
                              </span>
                            </span>
                            <span className="font-data font-semibold">{fmt(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedOrder.status === 'pending' && (
                        <Button
                          size="sm"
                          color="primary"
                          startContent={<CheckCircle className="w-4 h-4" />}
                          onPress={() =>
                            updateStatus.run({
                              id: selectedOrder.id,
                              body: { status: 'confirmed' },
                            })
                          }
                        >
                          {t('onlineOrders.confirm')}
                        </Button>
                      )}
                      {selectedOrder.status === 'confirmed' && (
                        <Button
                          size="sm"
                          color="primary"
                          startContent={<CheckCircle className="w-4 h-4" />}
                          onPress={() =>
                            updateStatus.run({
                              id: selectedOrder.id,
                              body: { status: 'processing' },
                            })
                          }
                        >
                          {t('onlineOrders.process')}
                        </Button>
                      )}
                      {selectedOrder.status === 'processing' && (
                        <Button
                          size="sm"
                          color="primary"
                          startContent={<Truck className="w-4 h-4" />}
                          onPress={() =>
                            updateStatus.run({ id: selectedOrder.id, body: { status: 'shipped' } })
                          }
                        >
                          {t('onlineOrders.ship')}
                        </Button>
                      )}
                      {selectedOrder.status === 'shipped' && (
                        <Button
                          size="sm"
                          color="success"
                          startContent={<CheckCircle className="w-4 h-4" />}
                          onPress={() =>
                            updateStatus.run({
                              id: selectedOrder.id,
                              body: { status: 'delivered' },
                            })
                          }
                        >
                          {t('onlineOrders.deliver')}
                        </Button>
                      )}
                      {!['delivered', 'cancelled', 'refunded'].includes(selectedOrder.status) && (
                        <Button
                          size="sm"
                          variant="bordered"
                          startContent={<XCircle className="w-4 h-4" />}
                          onPress={() =>
                            updateStatus.run({
                              id: selectedOrder.id,
                              body: { status: 'cancelled' },
                            })
                          }
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          {t('onlineOrders.cancel')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </ModalBody>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
