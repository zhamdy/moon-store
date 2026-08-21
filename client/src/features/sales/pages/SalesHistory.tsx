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
import type { ColumnDef } from '@tanstack/react-table';
import type { ReceiptData } from '../../../shared/components/Receipt';
import type { Sale, SaleDetail, SaleRefund, SalesMeta } from '../types';

const sales = resource<Sale, SalesMeta>('sales');
const saleDetails = resource<SaleDetail>('sales');

export default function SalesHistory() {
  const { t } = useTranslation();
  const transport = useTransport();
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [paymentFilter, setPaymentFilter] = useState('all');
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
  if (dateRange.start) params.from = format(dateRange.start, 'yyyy-MM-dd');
  if (dateRange.end) params.to = format(dateRange.end, 'yyyy-MM-dd');
  if (paymentFilter !== 'all') params.payment_method = paymentFilter;

  const { data: rows, meta, isLoading } = sales.useList({ ...params, limit: 200 });

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
      const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

      setReceiptData({
        saleId: sale.id,
        items,
        subtotal,
        discount: sale.discount || 0,
        discountType: sale.discount_type || 'fixed',
        total: sale.total,
        paymentMethod: sale.payment_method,
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
          className="text-primary hover:text-primary/80 transition-colors p-1"
          aria-label="Expand row details"
        >
          {expandedRow === row.original.id ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      ),
    },
    {
      accessorKey: 'id',
      header: t('sales.saleId'),
      cell: ({ getValue }) => (
        <span className="font-data text-primary font-semibold">#{getValue() as number}</span>
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
            <Button isIconOnly variant="light" size="sm" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Sale actions">
            <DropdownItem
              key="refund"
              isDisabled={row.original.refund_status === 'full'}
              startContent={<RotateCcw className="h-4 w-4 text-danger" />}
              onPress={() => handleRefund(row.original)}
            >
              {t('sales.refund')}
            </DropdownItem>
            <DropdownItem
              key="reprint"
              startContent={<Printer className="h-4 w-4 text-primary" />}
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
            startContent={<Download className="h-4 w-4" />}
            onClick={handleExportCSV}
          >
            {t('sales.exportCsv')}
          </Button>
        }
      />

      {/* Revenue summary StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('sales.totalRevenue')}
          value={formatCurrency(meta?.total_revenue || 0)}
          icon={DollarSign}
          isLoading={isLoading}
        />
        <StatCard
          title={t('sales.totalSales')}
          value={meta?.total || 0}
          icon={ShoppingCart}
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-72">
          <DateRangePicker value={dateRange} onChange={(range) => setDateRange(range)} />
        </div>

        <div className="w-44">
          <Select
            size="sm"
            variant="bordered"
            aria-label="Payment Filter"
            selectedKeys={[paymentFilter]}
            onChange={(e) => setPaymentFilter(e.target.value || 'all')}
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
              setDateRange({ start: null, end: null });
              setPaymentFilter('all');
            }}
          >
            {t('common.clearFilters')}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={rows ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('sales.searchPlaceholder')}
        enableDensityToggle
        renderSubComponent={(sale: Sale) => {
          if (expandedRow !== sale.id || !saleDetail || saleDetail.id !== sale.id) return null;
          const refunds = saleRefunds && expandedRow === sale.id ? saleRefunds : [];
          return (
            <div className="animate-fade-in space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">
                  {t('sales.itemBreakdown', { id: sale.id })}
                </h3>
                <div className="space-y-1.5 border border-border rounded-xl p-3 bg-muted/10">
                  {saleDetail.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm font-data">
                      <span className="text-foreground">
                        {item.product_name}{' '}
                        <span className="text-muted-foreground">x{item.quantity}</span>
                      </span>
                      <span className="text-foreground font-medium">
                        {formatCurrency(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                {sale.discount && sale.discount > 0 && (
                  <div className="flex justify-between text-sm font-data mt-2 pt-2 border-t border-border">
                    <span className="text-success font-medium">{t('sales.discount')}</span>
                    <span className="text-success font-medium">
                      {sale.discount_type === 'percentage'
                        ? `${sale.discount}%`
                        : formatCurrency(sale.discount)}
                    </span>
                  </div>
                )}
              </div>
              {refunds.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-danger mb-2 uppercase tracking-wider">
                    {t('sales.refund')}
                  </h3>
                  <div className="space-y-2">
                    {refunds.map((refund) => (
                      <div
                        key={refund.id}
                        className="text-sm font-data border border-border rounded-xl p-3 bg-muted/20"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-danger font-bold">
                            {formatCurrency(refund.amount)}
                          </span>
                          <span className="text-muted-foreground text-xs">
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
                            <span className="text-muted-foreground text-xs">
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
