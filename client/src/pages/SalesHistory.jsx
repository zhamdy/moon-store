import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, CalendarIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import DataTable from '../components/DataTable';
import { formatCurrency, formatDateTime, formatDate } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { useTranslation } from '../i18n';

export default function SalesHistory() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'Admin';
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState(null);

  const params = {};
  if (dateRange.from) params.from = format(dateRange.from, 'yyyy-MM-dd');
  if (dateRange.to) params.to = format(dateRange.to, 'yyyy-MM-dd');
  if (paymentFilter !== 'all') params.payment_method = paymentFilter;

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales', params],
    queryFn: () => api.get('/api/sales', { params: { ...params, limit: 200 } }).then((r) => r.data),
  });

  const { data: saleDetail } = useQuery({
    queryKey: ['sale-detail', expandedRow],
    queryFn: () => api.get(`/api/sales/${expandedRow}`).then((r) => r.data.data),
    enabled: !!expandedRow,
  });

  const handleExportCSV = () => {
    const sales = salesData?.data || [];
    if (sales.length === 0) return;

    const headers = ['Sale ID', 'Date', 'Items', 'Discount', 'Total', 'Payment', 'Cashier'];
    const rows = sales.map((s) => [
      s.id,
      formatDateTime(s.created_at),
      s.items_count,
      s.discount || 0,
      s.total,
      s.payment_method,
      s.cashier_name || '',
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moon-sales-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
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
      cell: ({ getValue }) => <span className="font-data text-gold">#{getValue()}</span>,
    },
    {
      accessorKey: 'created_at',
      header: t('sales.dateTime'),
      cell: ({ getValue }) => <span className="font-data">{formatDateTime(getValue())}</span>,
    },
    { accessorKey: 'items_count', header: t('sales.items') },
    {
      accessorKey: 'discount',
      header: t('sales.discount'),
      cell: ({ row }) => {
        const d = row.original.discount;
        if (!d || d === 0) return <span className="text-muted">-</span>;
        return (
          <span className="text-blush font-data">
            {row.original.discount_type === 'percentage' ? `${d}%` : formatCurrency(d)}
          </span>
        );
      },
    },
    {
      accessorKey: 'total',
      header: t('sales.total'),
      cell: ({ getValue }) => (
        <span className="font-semibold font-data">{formatCurrency(getValue())}</span>
      ),
    },
    {
      accessorKey: 'payment_method',
      header: t('sales.payment'),
      cell: ({ getValue }) => <Badge variant="gold">{getValue()}</Badge>,
    },
    { accessorKey: 'cashier_name', header: t('sales.cashier') },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">{t('sales.title')}</h1>
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
              <p className="text-xs text-muted uppercase tracking-widest font-body">{t('sales.totalRevenue')}</p>
              <p className="text-2xl font-semibold text-gold font-data">
                {formatCurrency(salesData.meta.total_revenue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-widest font-body">{t('sales.totalSales')}</p>
              <p className="text-2xl font-semibold text-foreground font-data">{salesData.meta.total}</p>
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
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="Card">Card</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
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
        data={salesData?.data}
        isLoading={isLoading}
        searchPlaceholder={t('sales.searchPlaceholder')}
      />

      {/* Expanded sale detail */}
      {expandedRow && saleDetail && (
        <Card className="border-gold/30 animate-fade-in">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-gold mb-3 font-display tracking-wider">
              {t('sales.itemBreakdown', { id: expandedRow })}
            </h3>
            <div className="space-y-2">
              {saleDetail.items?.map((item, i) => (
                <div key={i} className="flex justify-between text-sm font-data">
                  <span>{item.product_name} x{item.quantity}</span>
                  <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
