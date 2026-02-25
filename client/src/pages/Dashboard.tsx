import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { exportToCsv, exportToPdf } from '../lib/exportUtils';
import KpiCards from '../components/dashboard/KpiCards';
import DashboardCharts from '../components/dashboard/DashboardCharts';
import { useDashboardData } from '../hooks/useDashboardData';
import { formatDate } from '../lib/utils';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { DateRange } from '../components/ui/calendar';

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

  const handleExportCsv = (dataType: string) => {
    switch (dataType) {
      case 'revenue':
        exportToCsv('revenue.csv', (data.revenue || []) as unknown as Record<string, unknown>[], [
          { key: 'date', label: t('sales.dateTime') },
          { key: 'revenue', label: t('dashboard.revenue') },
        ]);
        break;
      case 'top-products':
        exportToCsv(
          'top-products.csv',
          (data.topProducts || []) as unknown as Record<string, unknown>[],
          [
            { key: 'name', label: t('common.name') },
            { key: 'total_sold', label: t('dashboard.itemsSold') },
          ]
        );
        break;
      case 'payment-methods':
        exportToCsv(
          'payment-methods.csv',
          (data.paymentMethods || []) as unknown as Record<string, unknown>[],
          [
            { key: 'payment_method', label: t('cart.paymentMethod') },
            { key: 'count', label: t('dashboard.salesCount') },
            { key: 'revenue', label: t('dashboard.revenue') },
          ]
        );
        break;
      case 'orders-per-day':
        exportToCsv(
          'orders-per-day.csv',
          (data.ordersPerDay || []) as unknown as Record<string, unknown>[],
          [
            { key: 'date', label: t('sales.dateTime') },
            { key: 'orders', label: t('charts.orders') },
          ]
        );
        break;
      case 'cashier-performance':
        exportToCsv(
          'cashier-performance.csv',
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
        exportToCsv(
          'sales-by-category.csv',
          (data.categorySales || []) as unknown as Record<string, unknown>[],
          [
            { key: 'category_name', label: t('inventory.categoryCol') },
            { key: 'total_sold', label: t('dashboard.itemsSold') },
            { key: 'revenue', label: t('dashboard.revenue') },
          ]
        );
        break;
      case 'sales-by-distributor':
        exportToCsv(
          'sales-by-distributor.csv',
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
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      await exportToPdf(
        'dashboard-content',
        `MOON-Report-${dateStr}.pdf`,
        `MOON Fashion & Style — ${t('dashboard.title')}`
      );
      toast.success(t('export.pdfExported'));
    } catch {
      toast.error(t('export.pdfFailed'));
    }
    setExporting(false);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('dashboard.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportPdf}
            disabled={exporting}
          >
            <FileText className="h-4 w-4 text-gold" />
            {exporting ? t('export.generating') : t('export.fullReport')}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4 text-gold" />
                {dateRange.from ? (
                  <>
                    {formatDate(dateRange.from)} - {dateRange.to ? formatDate(dateRange.to) : '...'}
                  </>
                ) : (
                  t('dashboard.selectDateRange')
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => setDateRange(range || { from: null, to: null })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div id="dashboard-content" className="space-y-6">
        <KpiCards
          kpis={data.kpis}
          isLoading={data.kpisLoading}
          onLowStockClick={() => navigate('/inventory?lowStock=true')}
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
