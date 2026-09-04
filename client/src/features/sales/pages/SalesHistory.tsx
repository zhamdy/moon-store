import { useState } from 'react';
import { format } from 'date-fns';
import {
  Download,
  ChevronDown,
  ChevronRight,
  Printer,
  RotateCcw,
  MoreHorizontal,
  DollarSign,
  ShoppingCart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Select,
  SelectItem,
} from '@heroui/react';
import {
  PageHeader,
  DataTable,
  StatCard,
  DateRangePicker,
  Badge,
  type DateRange,
} from '../../../shared';
import ReceiptDialog from '../../../shared/components/ReceiptDialog';
import RefundDialog from '../components/RefundDialog';
import { formatCurrency, formatDateTime } from '../../../shared/lib/utils';
import { exportToExcel } from '../../../shared/lib/exportUtils';
import { useTranslation } from '../../../shared/i18n/index';
import { resource } from '../../../shared/lib/resource';
import { useApiQuery } from '../../../shared/lib/apiQuery';
import { useTransport } from '../../../shared/lib/transport/index';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { useListRouteState, useLastPageRecovery } from '../../../shared/hooks/useListRouteState';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import type { ReceiptData } from '../../../shared/components/Receipt';
import type { Sale, SaleDetail, SaleRefund, SalesMeta } from '../types';

const sales = resource<Sale, SalesMeta>('sales');
const saleDetails = resource<SaleDetail>('sales');

export default function SalesHistory() {
  const { t } = useTranslation();
  const transport = useTransport();
  const { search: routeSearch, page, pageSize, update } = useListRouteState();

  const paymentFilter =
    typeof routeSearch.paymentMethod === 'string' ? routeSearch.paymentMethod : 'all';
  const sortBy = routeSearch.sortBy === 'total' ? 'total' : 'createdAt';
  const sortOrder = routeSearch.sortOrder === 'asc' ? 'asc' : 'desc';

  const dateRange: DateRange = {
    start: typeof routeSearch.dateFrom === 'string' ? new Date(routeSearch.dateFrom) : null,
    end: typeof routeSearch.dateTo === 'string' ? new Date(routeSearch.dateTo) : null,
  };

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };
  const sorting: SortingState = [
    { id: sortBy === 'total' ? 'total' : 'created_at', desc: sortOrder === 'desc' },
  ];

  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSale, setRefundSale] = useState<{
    id: number;
    total: number;
    refundedAmount: number;
    items: { product_id: number; product_name: string; quantity: number; unit_price: number }[];
  } | null>(null);

  const params: Record<string, string> = {};
  if (routeSearch.dateFrom) params.dateFrom = String(routeSearch.dateFrom);
  if (routeSearch.dateTo) params.dateTo = String(routeSearch.dateTo);
  if (paymentFilter !== 'all') params.paymentMethod = paymentFilter;
  if (debouncedSearch) params.search = debouncedSearch;
  params.page = String(page);
  params.pageSize = String(pageSize);
  params.sortBy = sortBy;
  params.sortOrder = sortOrder;

  const { data: rows, meta, isLoading, isFetching, error, refetch } = sales.useList(params);

  useLastPageRecovery(page, meta?.pagination?.totalItems, meta?.pagination?.totalPages, update);

  const { data: saleDetail } = saleDetails.useOne(expandedRow);

  const { data: saleRefunds } = useApiQuery<SaleRefund[]>(
    ['sale-refunds', expandedRow],
    `sales/${expandedRow}/refunds`,
    undefined,
    { enabled: !!expandedRow }
  );

  const handleExportCSV = () => {
    const exported = rows || [];
    if (exported.length === 0) return;

    const exportData = exported.map((s) => ({
      id: s.id,
      date: formatDateTime(s.created_at),
      items_count: s.items_count,
      discount: s.discount || 0,
      total: s.total,
      payment_method: s.payment_method,
      cashier_name: s.cashier_name || '',
    }));

    exportToExcel(`moon-sales-${format(new Date(), 'yyyy-MM-dd')}.xlsx`, exportData, [
      { key: 'id', label: 'Sale ID' },
      { key: 'date', label: 'Date' },
      { key: 'items_count', label: 'Items' },
      { key: 'discount', label: 'Discount' },
      { key: 'total', label: 'Total' },
      { key: 'payment_method', label: 'Payment' },
      { key: 'cashier_name', label: 'Cashier' },
    ]);
  };

  const readSale = (saleId: number) =>
    transport.request<SaleDetail>({ method: 'GET', path: `sales/${saleId}` });

  const handlePrintReceipt = async (saleId: number) => {
    try {
      const { data: sale } = await readSale(saleId);
      const items = (sale.items || []).map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

      // A reprint renders the same immutable, server-persisted calculation
      // snapshot as the original receipt did (Unit 6) -- never a client
      // recomputation from current settings, which may have changed since
      // the sale was rung up. A sale recorded before migration 003 has no
      // snapshot; the fallback derives only display totals from the row's
      // own persisted fields, never from current settings.
      const calc = sale.calculation;

      setReceiptData({
        saleId: sale.id,
        items,
        discountType: sale.discount_type || 'fixed',
        discountValue: sale.discount || 0,
        calculation: calc ?? {
          subtotal: items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
          manualDiscount: 0,
          couponDiscount: 0,
          pointsDiscount: 0,
          taxAmount: 0,
          taxMode: 'exclusive',
          taxRatePercent: 0,
          tipAmount: 0,
          amountDue: sale.total,
        },
        payments:
          sale.payments && sale.payments.length > 0
            ? sale.payments
            : [{ method: sale.payment_method, amount: calc?.amountDue ?? sale.total }],
        cashierName: sale.cashier_name || '',
        date: sale.created_at,
      });
      setReceiptOpen(true);
    } catch {
      toast.error(t('receipt.printFailed'));
    }
  };

  const handleRefund = async (sale: Sale) => {
    try {
      const { data: detail } = await readSale(sale.id);
      setRefundSale({
        id: sale.id,
        total: sale.total,
        refundedAmount: sale.refunded_amount || 0,
        items: detail.items || [],
      });
      setRefundOpen(true);
    } catch {
      toast.error(t('sales.refundFailed'));
    }
  };

  const columns: ColumnDef<Sale>[] = [
    {
      id: 'expand',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setExpandedRow(expandedRow === row.original.id ? null : row.original.id)}
          className="p-1 transition-colors text-primary hover:text-primary/80"
          aria-label="Expand row details"
        >
          {expandedRow === row.original.id ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      ),
    },
    {
      accessorKey: 'id',
      header: t('sales.saleId'),
      cell: ({ getValue }) => (
        <span className="font-semibold font-data text-primary">#{getValue() as number}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('sales.dateTime'),
      cell: ({ getValue }) => (
        <span className="font-data text-foreground">{formatDateTime(getValue() as string)}</span>
      ),
    },
    { accessorKey: 'items_count', header: t('sales.items') },
    {
      accessorKey: 'discount',
      header: t('sales.discount'),
      cell: ({ row }) => {
        const d = row.original.discount;
        if (!d || d === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <Badge variant="success" size="sm" className="font-data">
            {row.original.discount_type === 'percentage' ? `${d}%` : formatCurrency(d)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'total',
      header: t('sales.total'),
      cell: ({ getValue }) => (
        <span className="font-semibold font-data text-foreground">
          {formatCurrency(getValue() as number)}
        </span>
      ),
    },
    {
      accessorKey: 'payment_method',
      header: t('sales.payment'),
      cell: ({ getValue }) => {
        const method = getValue() as string;
        const labels: Record<string, string> = {
          Cash: t('cart.cash'),
          Card: t('cart.card'),
          Other: t('cart.other'),
          'Gift Card': t('cart.giftCard'),
        };
        const variantMap: Record<string, 'default' | 'primary' | 'success' | 'secondary'> = {
          Cash: 'success',
          Card: 'primary',
          'Gift Card': 'secondary',
          Other: 'default',
        };
        return (
          <Badge variant={variantMap[method] || 'default'} size="sm">
            {labels[method] || method}
          </Badge>
        );
      },
    },
    {
      id: 'refund_status',
      header: t('sales.refundStatus'),
      cell: ({ row }) => {
        const status = row.original.refund_status;
        if (!status) return <span className="text-muted-foreground">-</span>;
        return (
          <Badge variant={status === 'full' ? 'danger' : 'warning'} size="sm">
            {status === 'full' ? t('sales.refundFull') : t('sales.refundPartial')}
          </Badge>
        );
      },
    },
    { accessorKey: 'cashier_name', header: t('sales.cashier') },
    {
      id: 'customer_name',
      header: t('sales.customer'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.customer_name || t('sales.walkIn')}
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
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onClick={(e) => e.stopPropagation()}
              aria-label={t('common.actions')}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Sale actions">
            <DropdownItem
              key="refund"
              isDisabled={row.original.refund_status === 'full'}
              startContent={<RotateCcw className="w-4 h-4 text-danger" />}
              onPress={() => handleRefund(row.original)}
            >
              {t('sales.refund')}
            </DropdownItem>
            <DropdownItem
              key="reprint"
              startContent={<Printer className="w-4 h-4 text-primary" />}
              onPress={() => handlePrintReceipt(row.original.id)}
            >
              {t('receipt.reprint')}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader
        title={t('sales.title')}
        actions={
          <Button
            variant="bordered"
            size="sm"
            startContent={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            {t('sales.exportCsv')}
          </Button>
        }
      />

      {/* Revenue summary StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('sales.totalRevenue')}
          value={formatCurrency(meta?.aggregates.totalRevenue || 0)}
          icon={DollarSign}
          isLoading={isLoading}
        />
        <StatCard
          title={t('sales.totalSales')}
          value={meta?.aggregates.totalSales || 0}
          icon={ShoppingCart}
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-72">
          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              update({
                dateFrom: range.start ? format(range.start, 'yyyy-MM-dd') : undefined,
                dateTo: range.end ? format(range.end, 'yyyy-MM-dd') : undefined,
                page: 1,
              });
            }}
          />
        </div>

        <div className="w-44">
          <Select
            size="sm"
            variant="bordered"
            aria-label="Payment Filter"
            selectedKeys={[paymentFilter]}
            onChange={(e) => {
              update({
                paymentMethod:
                  e.target.value && e.target.value !== 'all' ? e.target.value : undefined,
                page: 1,
              });
            }}
          >
            <SelectItem key="all" textValue={t('sales.allPayments')}>
              {t('sales.allPayments')}
            </SelectItem>
            <SelectItem key="Cash" textValue={t('cart.cash')}>
              {t('cart.cash')}
            </SelectItem>
            <SelectItem key="Card" textValue={t('cart.card')}>
              {t('cart.card')}
            </SelectItem>
            <SelectItem key="Other" textValue={t('cart.other')}>
              {t('cart.other')}
            </SelectItem>
          </Select>
        </div>

        {(dateRange.start || paymentFilter !== 'all') && (
          <Button
            variant="light"
            size="sm"
            onClick={() => {
              update({
                dateFrom: undefined,
                dateTo: undefined,
                paymentMethod: undefined,
                page: 1,
              });
            }}
          >
            {t('common.clearFilters')}
          </Button>
        )}
      </div>

      <DataTable
        mode="server"
        columns={columns}
        data={rows ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error instanceof Error ? error.message : undefined}
        onRetry={() => void refetch()}
        pagination={pagination}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater;
          update({ page: next.pageIndex + 1, pageSize: next.pageSize });
        }}
        pageCount={meta?.pagination.totalPages ?? 0}
        totalRows={meta?.pagination.totalItems ?? 0}
        sorting={sorting}
        onSortingChange={(updater) => {
          const next = typeof updater === 'function' ? updater(sorting) : updater;
          const sortItem = next[0];
          update({
            sortBy: sortItem?.id === 'total' ? 'total' : 'createdAt',
            sortOrder: sortItem?.desc === false ? 'asc' : 'desc',
            page: 1,
          });
        }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          update({ page: 1 });
        }}
        isFiltered={Boolean(search || dateRange.start || dateRange.end || paymentFilter !== 'all')}
        searchPlaceholder={t('sales.searchReceipts')}
        renderSubComponent={(sale: Sale) => {
          if (expandedRow !== sale.id || !saleDetail || saleDetail.id !== sale.id) return null;
          const refunds = saleRefunds && expandedRow === sale.id ? saleRefunds : [];
          return (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="mb-2 text-xs font-semibold tracking-wider uppercase text-primary">
                  {t('sales.itemBreakdown', { id: sale.id })}
                </h3>
                <div className="space-y-1.5 border border-border rounded-xl p-3 bg-muted/10">
                  {saleDetail.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm font-data">
                      <span className="text-foreground">
                        {item.product_name}{' '}
                        <span className="text-muted-foreground">x{item.quantity}</span>
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                {sale.discount && sale.discount > 0 && (
                  <div className="flex justify-between pt-2 mt-2 text-sm border-t font-data border-border">
                    <span className="font-medium text-success">{t('sales.discount')}</span>
                    <span className="font-medium text-success"></span>
                  </div>
                )}
              </div>
              {refunds.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-wider uppercase text-danger">
                    {t('sales.refund')}
                  </h3>
                  <div className="space-y-2">
                    {refunds.map((refund) => (
                      <div
                        key={refund.id}
                        className="p-3 text-sm border font-data border-border rounded-xl bg-muted/20"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-danger">
                            {formatCurrency(refund.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(refund.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" size="sm">
                            {{
                              'Customer Return': t('sales.refundReasonCustomerReturn'),
                              'Cashier Error': t('sales.refundReasonCashierError'),
                              Defective: t('sales.refundReasonDefective'),
                              Other: t('sales.refundReasonOther'),
                            }[refund.reason] || refund.reason}
                          </Badge>
                          {refund.cashier_name && (
                            <span className="text-xs text-muted-foreground">
                              {refund.cashier_name}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }}
      />

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />

      {refundSale && (
        <RefundDialog
          open={refundOpen}
          onOpenChange={setRefundOpen}
          saleId={refundSale.id}
          saleTotal={refundSale.total}
          refundedAmount={refundSale.refundedAmount}
          items={refundSale.items}
        />
      )}
    </div>
  );
}
