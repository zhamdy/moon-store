import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Download,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  Printer,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import DataTable from '../components/DataTable';
import ReceiptDialog from '../components/ReceiptDialog';
import RefundDialog from '../components/RefundDialog';
import { formatCurrency, formatDateTime, formatDate } from '../lib/utils';
import { exportToExcel } from '../lib/exportUtils';

import api from '../services/api';
import { useTranslation } from '../i18n';
import type { ColumnDef } from '@tanstack/react-table';
import type { DateRange } from '../components/ui/calendar';
import type { ReceiptData } from '../components/Receipt';

interface Sale {
  id: number;
  total: number;
  discount: number | null;
  discount_type: 'fixed' | 'percentage' | null;
  payment_method: string;
  cashier_id: number;
  cashier_name: string;
  items_count: number;
  created_at: string;
  refund_status: 'partial' | 'full' | null;
  refunded_amount: number | null;
  customer_id: number | null;
  customer_name: string | null;
}

interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Refund {
  id: number;
  amount: number;
  reason: string;
  cashier_name: string | null;
  created_at: string;
  items: { product_id: number; product_name: string; quantity: number; unit_price: number }[];
}

interface SaleDetail {
  id: number;
  total: number;
  discount: number | null;
  discount_type: string | null;
  payment_method: string;
  items: SaleItem[];
}

interface SalesResponse {
  success: boolean;
  data: Sale[];
  meta: {
    total: number;
    total_revenue: number;
    page: number;
    limit: number;
  };
}

export default function SalesHistory() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
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
  if (dateRange.from) params.from = format(dateRange.from, 'yyyy-MM-dd');
  if (dateRange.to) params.to = format(dateRange.to, 'yyyy-MM-dd');
  if (paymentFilter !== 'all') params.payment_method = paymentFilter;

  const { data: salesData, isLoading } = useQuery<SalesResponse>({
    queryKey: ['sales', params],
    queryFn: () =>
      api.get('/api/v1/sales', { params: { ...params, limit: 200 } }).then((r) => r.data),
  });

  const { data: saleDetail } = useQuery<SaleDetail>({
    queryKey: ['sale-detail', expandedRow],
    queryFn: () => api.get(`/api/v1/sales/${expandedRow}`).then((r) => r.data.data),
    enabled: !!expandedRow,
  });

  const { data: saleRefunds } = useQuery<Refund[]>({
    queryKey: ['sale-refunds', expandedRow],
    queryFn: () => api.get(`/api/v1/sales/${expandedRow}/refunds`).then((r) => r.data.data),
    enabled: !!expandedRow,
  });

  const handleExportCSV = () => {
    const sales = salesData?.data || [];
    if (sales.length === 0) return;

    const exportData = sales.map((s) => ({
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

  const handlePrintReceipt = async (saleId: number) => {
    try {
      const response = await api.get(`/api/v1/sales/${saleId}`);
      const sale = response.data.data;
      const items = (sale.items || []).map(
        (item: { product_name: string; quantity: number; unit_price: number }) => ({
          name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })
      );
      const subtotal = items.reduce(
        (sum: number, item: { unit_price: number; quantity: number }) =>
          sum + item.unit_price * item.quantity,
        0
      );

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
      const response = await api.get(`/api/v1/sales/${sale.id}`);
      const detail = response.data.data;
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
          onClick={() => setExpandedRow(expandedRow === row.original.id ? null : row.original.id)}
          className="text-gold"
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
      cell: ({ getValue }) => <span className="font-data text-gold">#{getValue() as number}</span>,
    },
    {
      accessorKey: 'created_at',
      header: t('sales.dateTime'),
      cell: ({ getValue }) => (
        <span className="font-data">{formatDateTime(getValue() as string)}</span>
      ),
    },
    { accessorKey: 'items_count', header: t('sales.items') },
    {
      accessorKey: 'discount',
      header: t('sales.discount'),
      cell: ({ row }) => {
        const d = row.original.discount;
        if (!d || d === 0) return <span className="text-muted">-</span>;
        return (
          <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400 font-data">
            {row.original.discount_type === 'percentage' ? `${d}%` : formatCurrency(d)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'total',
      header: t('sales.total'),
      cell: ({ getValue }) => (
        <span className="font-semibold font-data">{formatCurrency(getValue() as number)}</span>
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
        return <Badge variant="gold">{labels[method] || method}</Badge>;
      },
    },
    {
      id: 'refund_status',
      header: t('sales.refundStatus'),
      cell: ({ row }) => {
        const status = row.original.refund_status;
        if (!status) return <span className="text-muted">-</span>;
        return (
          <Badge
            variant="outline"
            className={
              status === 'full'
                ? 'border-red-400 text-red-600 dark:text-red-400'
                : 'border-amber-400 text-amber-600 dark:text-amber-400'
            }
          >
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
        <span className="text-muted">{row.original.customer_name || t('sales.walkIn')}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={row.original.refund_status === 'full'}
              onClick={(e) => {
                e.stopPropagation();
                handleRefund(row.original);
              }}
            >
              <RotateCcw className="h-4 w-4 me-2 text-blush" />
              {t('sales.refund')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handlePrintReceipt(row.original.id);
              }}
            >
              <Printer className="h-4 w-4 me-2 text-gold" />
              {t('receipt.reprint')}
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
            {t('sales.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
          <Download className="h-4 w-4 text-gold" />
          {t('sales.exportCsv')}
        </Button>
      </div>

      {/* Revenue summary */}
      {salesData?.meta && (
        <Card>
          <CardContent className="p-4 flex items-center gap-6">
            <div>
              <p className="text-xs text-muted uppercase tracking-widest font-body">
                {t('sales.totalRevenue')}
              </p>
              <p className="text-2xl font-semibold text-gold font-data">
                {formatCurrency(salesData.meta.total_revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-widest font-body">
                {t('sales.totalSales')}
              </p>
              <p className="text-2xl font-semibold text-foreground font-data">
                {salesData.meta.total}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4 text-gold" />
              {dateRange.from
                ? `${formatDate(dateRange.from)} - ${dateRange.to ? formatDate(dateRange.to) : '...'}`
                : t('sales.dateRange')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => setDateRange(range || { from: null, to: null })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sales.allPayments')}</SelectItem>
            <SelectItem value="Cash">{t('cart.cash')}</SelectItem>
            <SelectItem value="Card">{t('cart.card')}</SelectItem>
            <SelectItem value="Other">{t('cart.other')}</SelectItem>
          </SelectContent>
        </Select>

        {(dateRange.from || paymentFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateRange({ from: null, to: null });
              setPaymentFilter('all');
            }}
          >
            {t('common.clearFilters')}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={salesData?.data ?? []}
        isLoading={isLoading}
        searchPlaceholder={t('sales.searchPlaceholder')}
        renderSubComponent={(sale: Sale) => {
          if (expandedRow !== sale.id || !saleDetail || saleDetail.id !== sale.id) return null;
          const refunds = saleRefunds && expandedRow === sale.id ? saleRefunds : [];
          return (
            <div className="animate-fade-in space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gold mb-2 font-display tracking-wider">
                  {t('sales.itemBreakdown', { id: sale.id })}
                </h3>
                <div className="space-y-1.5">
                  {saleDetail.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm font-data">
                      <span>
                        {item.product_name} <span className="text-muted">x{item.quantity}</span>
                      </span>
                      <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                {sale.discount && sale.discount > 0 && (
                  <div className="flex justify-between text-sm font-data mt-2 pt-2 border-t border-border">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t('sales.discount')}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {sale.discount_type === 'percentage'
                        ? `${sale.discount}%`
                        : formatCurrency(sale.discount)}
                    </span>
                  </div>
                )}
              </div>
              {refunds.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-blush mb-2 font-display tracking-wider">
                    {t('sales.refund')}
                  </h3>
                  <div className="space-y-2">
                    {refunds.map((refund) => (
                      <div
                        key={refund.id}
                        className="text-sm font-data border border-border rounded-md p-3 bg-surface/50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {formatCurrency(refund.amount)}
                          </span>
                          <span className="text-muted text-xs">
                            {formatDateTime(refund.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {{
                              'Customer Return': t('sales.refundReasonCustomerReturn'),
                              'Cashier Error': t('sales.refundReasonCashierError'),
                              Defective: t('sales.refundReasonDefective'),
                              Other: t('sales.refundReasonOther'),
                            }[refund.reason] || refund.reason}
                          </Badge>
                          {refund.cashier_name && (
                            <span className="text-muted text-xs">{refund.cashier_name}</span>
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
