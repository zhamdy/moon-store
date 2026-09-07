import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FileText, CalendarIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { Calendar } from '../../../shared/components/Calendar';
import { PageHeader } from '../../../shared';
import { exportToExcel, exportMultiSheetExcel } from '../../../shared/lib/exportUtils';
import KpiCards from '../components/KpiCards';
import DashboardCharts from '../components/DashboardCharts';
import { useDashboardData } from '../hooks/useDashboardData';
import { formatDate } from '../../../shared/lib/utils';
import { format } from 'date-fns';
import { useTranslation } from '../../../shared/i18n/index';
import type { DateRange } from '../../../shared/components/Calendar';

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const { t } = useTranslation();
  const navigate = useNavigate();

  const dateParams: Record<string, string> =
    dateRange.from && dateRange.to
      ? { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') }
      : {};

  const data = useDashboardData(dateParams);

  const [exporting, setExporting] = useState(false);

  const handleExportCsv = useCallback(
    (dataType: string) => {
      switch (dataType) {
        case 'revenue':
          exportToExcel(
            'revenue.xlsx',
            (data.revenue || []) as unknown as Record<string, unknown>[],
            [
              { key: 'date', label: t('sales.dateTime') },
              { key: 'revenue', label: t('dashboard.revenue') },
            ]
          );
          break;
        case 'top-products':
          exportToExcel(
            'top-products.xlsx',
            (data.topProducts || []) as unknown as Record<string, unknown>[],
            [
              { key: 'name', label: t('common.name') },
              { key: 'total_sold', label: t('dashboard.itemsSold') },
            ]
          );
          break;
        case 'payment-methods':
          exportToExcel(
            'payment-methods.xlsx',
            (data.paymentMethods || []) as unknown as Record<string, unknown>[],
            [
              { key: 'payment_method', label: t('cart.paymentMethod') },
              { key: 'count', label: t('dashboard.salesCount') },
              { key: 'revenue', label: t('dashboard.revenue') },
            ]
          );
          break;
        case 'orders-per-day':
          exportToExcel(
            'orders-per-day.xlsx',
            (data.ordersPerDay || []) as unknown as Record<string, unknown>[],
            [
              { key: 'date', label: t('sales.dateTime') },
              { key: 'orders', label: t('charts.orders') },
            ]
          );
          break;
        case 'cashier-performance':
          exportToExcel(
            'cashier-performance.xlsx',
            (data.cashierPerformance || []) as unknown as Record<string, unknown>[],
            [
              { key: 'cashier_name', label: t('dashboard.cashierName') },
              { key: 'total_sales', label: t('dashboard.salesCount') },
              { key: 'total_revenue', label: t('dashboard.revenue') },
              { key: 'avg_order_value', label: t('dashboard.avgOrder') },
              { key: 'total_items', label: t('dashboard.itemsSold') },
            ]
          );
          break;
        case 'sales-by-category':
          exportToExcel(
            'sales-by-category.xlsx',
            (data.categorySales || []) as unknown as Record<string, unknown>[],
            [
              { key: 'category_name', label: t('inventory.categoryCol') },
              { key: 'total_sold', label: t('dashboard.itemsSold') },
              { key: 'revenue', label: t('dashboard.revenue') },
            ]
          );
          break;
        case 'sales-by-distributor':
          exportToExcel(
            'sales-by-distributor.xlsx',
            (data.distributorSales || []) as unknown as Record<string, unknown>[],
            [
              { key: 'distributor_name', label: t('inventory.distributor') },
              { key: 'total_sold', label: t('dashboard.itemsSold') },
              { key: 'revenue', label: t('dashboard.revenue') },
            ]
          );
          break;
      }
      toast.success(t('export.csvExported'));
    },
    [data, t]
  );

  const handleExportPdf = () => {
    setExporting(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      exportMultiSheetExcel(`MOON-Report-${dateStr}.xlsx`, [
        {
          name: 'Revenue',
          data: (data.revenue || []) as unknown as Record<string, unknown>[],
          columns: [
            { key: 'date', label: t('sales.dateTime') },
            { key: 'revenue', label: t('dashboard.revenue') },
          ],
        },
        {
          name: 'Top Products',
          data: (data.topProducts || []) as unknown as Record<string, unknown>[],
          columns: [
            { key: 'name', label: t('common.name') },
            { key: 'total_sold', label: t('dashboard.itemsSold') },
          ],
        },
        {
          name: 'Payment Methods',
          data: (data.paymentMethods || []) as unknown as Record<string, unknown>[],
          columns: [
            { key: 'payment_method', label: t('cart.paymentMethod') },
            { key: 'count', label: t('dashboard.salesCount') },
            { key: 'revenue', label: t('dashboard.revenue') },
          ],
        },
        {
          name: 'Orders Per Day',
          data: (data.ordersPerDay || []) as unknown as Record<string, unknown>[],
          columns: [
            { key: 'date', label: t('sales.dateTime') },
            { key: 'orders', label: t('charts.orders') },
          ],
        },
        {
          name: 'Cashier Performance',
          data: (data.cashierPerformance || []) as unknown as Record<string, unknown>[],
          columns: [
            { key: 'cashier_name', label: t('dashboard.cashierName') },
            { key: 'total_sales', label: t('dashboard.salesCount') },
            { key: 'total_revenue', label: t('dashboard.revenue') },
            { key: 'avg_order_value', label: t('dashboard.avgOrder') },
            { key: 'total_items', label: t('dashboard.itemsSold') },
          ],
        },
        {
          name: 'Sales by Category',
          data: (data.categorySales || []) as unknown as Record<string, unknown>[],
          columns: [
            { key: 'category_name', label: t('inventory.categoryCol') },
            { key: 'total_sold', label: t('dashboard.itemsSold') },
            { key: 'revenue', label: t('dashboard.revenue') },
          ],
        },
        {
          name: 'Sales by Distributor',
          data: (data.distributorSales || []) as unknown as Record<string, unknown>[],
          columns: [
            { key: 'distributor_name', label: t('inventory.distributor') },
            { key: 'total_sold', label: t('dashboard.itemsSold') },
            { key: 'revenue', label: t('dashboard.revenue') },
          ],
        },
      ]);
      toast.success(t('export.csvExported'));
    } catch {
      toast.error(t('export.pdfFailed'));
    }
    setExporting(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <PageHeader title={t('dashboard.title')}>
        <div className="flex items-center gap-2">
          <Button
            variant="bordered"
            size="sm"
            startContent={<FileText className="h-4 w-4 text-muted-foreground" />}
            onPress={handleExportPdf}
            isLoading={exporting}
          >
            {exporting ? t('export.generating') : t('export.fullReport')}
          </Button>

          <Popover placement="bottom-end">
            <PopoverTrigger>
              <Button
                variant="bordered"
                size="sm"
                startContent={<CalendarIcon className="h-4 w-4 text-muted-foreground" />}
              >
                {dateRange.from ? (
                  <>
                    {formatDate(dateRange.from)} - {dateRange.to ? formatDate(dateRange.to) : '...'}
                  </>
                ) : (
                  t('dashboard.selectDateRange')
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 bg-card border border-border">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => setDateRange(range || { from: null, to: null })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </PageHeader>

      <div id="dashboard-content" className="space-y-6">
        <KpiCards
          kpis={data.kpis}
          isLoading={data.kpisLoading}
          onLowStockClick={() =>
            navigate({ to: '/inventory', search: { lowStock: 'true' } as never })
          }
        />
        <DashboardCharts
          revenue={data.revenue}
          revenueLoading={data.revenueLoading}
          topProducts={data.topProducts}
          topLoading={data.topLoading}
          paymentMethods={data.paymentMethods}
          paymentLoading={data.paymentLoading}
          ordersPerDay={data.ordersPerDay}
          ordersLoading={data.ordersLoading}
          cashierPerformance={data.cashierPerformance}
          cashierLoading={data.cashierLoading}
          categorySales={data.categorySales}
          categoryLoading={data.categoryLoading}
          distributorSales={data.distributorSales}
          distributorLoading={data.distributorLoading}
          onExportCsv={handleExportCsv}
        />
      </div>
    </div>
  );
}
