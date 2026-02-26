import {
  Download,
  BarChart3,
  TrendingUp,
  CreditCard,
  CalendarDays,
  Users,
  Layers,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import EmptyState from '../EmptyState';
import RevenueChart from '../charts/RevenueChart';
import TopProductsChart from '../charts/TopProductsChart';
import PaymentPieChart from '../charts/PaymentPieChart';
import OrdersAreaChart from '../charts/OrdersAreaChart';
import CashierPerformanceChart from '../charts/CashierPerformanceChart';
import CategorySalesChart from '../charts/CategorySalesChart';
import DistributorSalesChart from '../charts/DistributorSalesChart';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from '../../i18n';
import type {
  RevenueDataPoint,
  TopProduct,
  PaymentMethod,
  OrdersPerDay,
  CashierPerformance,
  CategorySales,
  DistributorSales,
} from '../../hooks/useDashboardData';

interface DashboardChartsProps {
  revenue: RevenueDataPoint[] | undefined;
  revenueLoading: boolean;
  topProducts: TopProduct[] | undefined;
  topLoading: boolean;
  paymentMethods: PaymentMethod[] | undefined;
  paymentLoading: boolean;
  ordersPerDay: OrdersPerDay[] | undefined;
  ordersLoading: boolean;
  cashierPerformance: CashierPerformance[] | undefined;
  cashierLoading: boolean;
  categorySales: CategorySales[] | undefined;
  categoryLoading: boolean;
  distributorSales: DistributorSales[] | undefined;
  distributorLoading: boolean;
  onExportCsv: (dataType: string) => void;
}

export default function DashboardCharts({
  revenue,
  revenueLoading,
  topProducts,
  topLoading,
  paymentMethods,
  paymentLoading,
  ordersPerDay,
  ordersLoading,
  cashierPerformance,
  cashierLoading,
  categorySales,
  categoryLoading,
  distributorSales,
  distributorLoading,
  onExportCsv,
}: DashboardChartsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t('dashboard.dailyRevenue')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExportCsv('revenue')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-3.5 w-3.5 text-muted" />
            </Button>
          </CardHeader>
          <CardContent aria-busy={revenueLoading}>
            {revenueLoading ? (
              <Skeleton variant="chart" />
            ) : !revenue || revenue.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <RevenueChart data={revenue} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t('dashboard.topSellers')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExportCsv('top-products')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-3.5 w-3.5 text-muted" />
            </Button>
          </CardHeader>
          <CardContent aria-busy={topLoading}>
            {topLoading ? (
              <Skeleton variant="chart" />
            ) : !topProducts || topProducts.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <TopProductsChart data={topProducts} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t('dashboard.paymentMethods')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExportCsv('payment-methods')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-3.5 w-3.5 text-muted" />
            </Button>
          </CardHeader>
          <CardContent aria-busy={paymentLoading}>
            {paymentLoading ? (
              <Skeleton variant="chart" />
            ) : !paymentMethods || paymentMethods.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <PaymentPieChart data={paymentMethods} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t('dashboard.ordersPerDay')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExportCsv('orders-per-day')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-3.5 w-3.5 text-muted" />
            </Button>
          </CardHeader>
          <CardContent aria-busy={ordersLoading}>
            {ordersLoading ? (
              <Skeleton variant="chart" />
            ) : !ordersPerDay || ordersPerDay.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <OrdersAreaChart data={ordersPerDay} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cashier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t('dashboard.cashierRevenue')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExportCsv('cashier-performance')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-3.5 w-3.5 text-muted" />
            </Button>
          </CardHeader>
          <CardContent aria-busy={cashierLoading}>
            {cashierLoading ? (
              <Skeleton variant="chart" />
            ) : !cashierPerformance || cashierPerformance.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <CashierPerformanceChart data={cashierPerformance} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t('dashboard.cashierStats')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExportCsv('cashier-performance')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-3.5 w-3.5 text-muted" />
            </Button>
          </CardHeader>
          <CardContent aria-busy={cashierLoading}>
            {cashierLoading ? (
              <Skeleton variant="chart" />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="text-start py-2 font-medium">{t('dashboard.cashierName')}</th>
                      <th className="text-end py-2 font-medium">{t('dashboard.salesCount')}</th>
                      <th className="text-end py-2 font-medium">{t('dashboard.revenue')}</th>
                      <th className="text-end py-2 font-medium">{t('dashboard.avgOrder')}</th>
                      <th className="text-end py-2 font-medium">{t('dashboard.itemsSold')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cashierPerformance || []).map((c) => (
                      <tr key={c.cashier_id} className="border-b border-border/50">
                        <td className="py-2 font-medium">{c.cashier_name}</td>
                        <td className="py-2 text-end font-data">{c.total_sales}</td>
                        <td className="py-2 text-end font-data text-gold">
                          {formatCurrency(c.total_revenue)}
                        </td>
                        <td className="py-2 text-end font-data">
                          {formatCurrency(c.avg_order_value)}
                        </td>
                        <td className="py-2 text-end font-data">{c.total_items}</td>
                      </tr>
                    ))}
                    {(!cashierPerformance || cashierPerformance.length === 0) && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-muted"
                          role="status"
                          aria-live="polite"
                        >
                          {t('common.noResults')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category & Distributor Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t('dashboard.salesByCategory')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExportCsv('sales-by-category')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-3.5 w-3.5 text-muted" />
            </Button>
          </CardHeader>
          <CardContent aria-busy={categoryLoading}>
            {categoryLoading ? (
              <Skeleton variant="chart" />
            ) : !categorySales || categorySales.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <CategorySalesChart data={categorySales} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg">{t('dashboard.salesByDistributor')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExportCsv('sales-by-distributor')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-3.5 w-3.5 text-muted" />
            </Button>
          </CardHeader>
          <CardContent aria-busy={distributorLoading}>
            {distributorLoading ? (
              <Skeleton variant="chart" />
            ) : !distributorSales || distributorSales.length === 0 ? (
              <EmptyState
                icon={Building2}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <DistributorSalesChart data={distributorSales} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
