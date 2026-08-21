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
import { Card, CardHeader, CardBody, Button, Skeleton } from '@heroui/react';
import EmptyState from '../../../shared/components/EmptyState';
import RevenueChart from './charts/RevenueChart';
import TopProductsChart from './charts/TopProductsChart';
import PaymentPieChart from './charts/PaymentPieChart';
import OrdersAreaChart from './charts/OrdersAreaChart';
import CashierPerformanceChart from './charts/CashierPerformanceChart';
import CategorySalesChart from './charts/CategorySalesChart';
import DistributorSalesChart from './charts/DistributorSalesChart';
import { formatCurrency } from '../../../shared/lib/utils';
import { useTranslation } from '../../../shared/i18n/index';
import type {
  RevenueDataPoint,
  TopProduct,
  PaymentMethod,
  OrdersPerDay,
  CashierPerformance,
  CategorySales,
  DistributorSales,
} from '../hooks/useDashboardData';

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
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">
              {t('dashboard.dailyRevenue')}
            </h3>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onExportCsv('revenue')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardBody className="p-6" aria-busy={revenueLoading}>
            {revenueLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !revenue || revenue.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <RevenueChart data={revenue} />
            )}
          </CardBody>
        </Card>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">{t('dashboard.topSellers')}</h3>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onExportCsv('top-products')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardBody className="p-6" aria-busy={topLoading}>
            {topLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !topProducts || topProducts.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <TopProductsChart data={topProducts} />
            )}
          </CardBody>
        </Card>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">
              {t('dashboard.paymentMethods')}
            </h3>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onExportCsv('payment-methods')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardBody className="p-6" aria-busy={paymentLoading}>
            {paymentLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !paymentMethods || paymentMethods.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <PaymentPieChart data={paymentMethods} />
            )}
          </CardBody>
        </Card>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">
              {t('dashboard.ordersPerDay')}
            </h3>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onExportCsv('orders-per-day')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardBody className="p-6" aria-busy={ordersLoading}>
            {ordersLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !ordersPerDay || ordersPerDay.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <OrdersAreaChart data={ordersPerDay} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Cashier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">
              {t('dashboard.cashierRevenue')}
            </h3>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onExportCsv('cashier-performance')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardBody className="p-6" aria-busy={cashierLoading}>
            {cashierLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !cashierPerformance || cashierPerformance.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <CashierPerformanceChart data={cashierPerformance} />
            )}
          </CardBody>
        </Card>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">
              {t('dashboard.cashierStats')}
            </h3>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onExportCsv('cashier-performance')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardBody className="p-6" aria-busy={cashierLoading}>
            {cashierLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-start py-2 font-medium">{t('dashboard.cashierName')}</th>
                      <th className="text-end py-2 font-medium">{t('dashboard.salesCount')}</th>
                      <th className="text-end py-2 font-medium">{t('dashboard.revenue')}</th>
                      <th className="text-end py-2 font-medium">{t('dashboard.avgOrder')}</th>
                      <th className="text-end py-2 font-medium">{t('dashboard.itemsSold')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cashierPerformance || []).map((c) => (
                      <tr
                        key={c.cashier_id}
                        className="border-b border-border/50 hover:bg-muted/30"
                      >
                        <td className="py-2 font-medium">{c.cashier_name}</td>
                        <td className="py-2 text-end font-data">{c.total_sales}</td>
                        <td className="py-2 text-end font-data text-primary font-medium">
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
                          className="py-8 text-center text-muted-foreground"
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
          </CardBody>
        </Card>
      </div>

      {/* Category & Distributor Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">
              {t('dashboard.salesByCategory')}
            </h3>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onExportCsv('sales-by-category')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardBody className="p-6" aria-busy={categoryLoading}>
            {categoryLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !categorySales || categorySales.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <CategorySalesChart data={categorySales} />
            )}
          </CardBody>
        </Card>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-6 py-4">
            <h3 className="text-base font-semibold text-foreground">
              {t('dashboard.salesByDistributor')}
            </h3>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => onExportCsv('sales-by-distributor')}
              title={t('export.csv')}
              aria-label={t('export.csv')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardBody className="p-6" aria-busy={distributorLoading}>
            {distributorLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : !distributorSales || distributorSales.length === 0 ? (
              <EmptyState
                icon={Building2}
                title={t('charts.noData')}
                description={t('charts.noDataDesc')}
              />
            ) : (
              <DistributorSalesChart data={distributorSales} />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
