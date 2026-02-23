import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingBag, Truck, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { Skeleton } from '../components/ui/skeleton';
import RevenueChart from '../components/charts/RevenueChart';
import TopProductsChart from '../components/charts/TopProductsChart';
import PaymentPieChart from '../components/charts/PaymentPieChart';
import OrdersAreaChart from '../components/charts/OrdersAreaChart';
import CashierPerformanceChart from '../components/charts/CashierPerformanceChart';
import { formatCurrency, formatDate } from '../lib/utils';
import api from '../services/api';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { LucideIcon } from 'lucide-react';
import type { DateRange } from '../components/ui/calendar';

interface KpiData {
  today_revenue: number;
  month_revenue: number;
  month_profit: number;
  total_sales: number;
  pending_deliveries: number;
  low_stock_items: number;
}

interface RevenueDataPoint {
  date: string;
  revenue: number;
}

interface TopProduct {
  name: string;
  total_sold: number;
}

interface PaymentMethod {
  payment_method: string;
  count: number;
  revenue: number;
}

interface OrdersPerDay {
  date: string;
  orders: number;
}

interface CashierPerformance {
  cashier_id: number;
  cashier_name: string;
  total_sales: number;
  total_revenue: number;
  avg_order_value: number;
  total_items: number;
}

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  isLoading: boolean;
  onClick?: () => void;
  variant?: 'default' | 'warning';
}

function KpiCard({
  title,
  value,
  icon: Icon,
  isLoading,
  onClick,
  variant = 'default',
}: KpiCardProps) {
  const isWarning = variant === 'warning' && !isLoading && Number(value) > 0;
  return (
    <Card
      className={
        onClick
          ? `cursor-pointer transition-all hover:border-gold/50 hover:shadow-md ${isWarning ? 'border-amber-500/40' : ''}`
          : isWarning
            ? 'border-amber-500/40'
            : ''
      }
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest font-body">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p
                className={`text-2xl font-semibold font-data mt-1 ${isWarning ? 'text-amber-400' : 'text-foreground'}`}
              >
                {value}
              </p>
            )}
          </div>
          <div
            className={`h-12 w-12 rounded-md flex items-center justify-center ${isWarning ? 'bg-amber-500/10' : 'bg-gold/10'}`}
          >
            <Icon className={`h-6 w-6 ${isWarning ? 'text-amber-400' : 'text-gold'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const { t } = useTranslation();
  const navigate = useNavigate();

  const dateParams =
    dateRange.from && dateRange.to
      ? { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') }
      : {};

  const { data: kpis, isLoading: kpisLoading } = useQuery<KpiData>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api.get('/api/analytics/dashboard').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery<RevenueDataPoint[]>({
    queryKey: ['revenue', dateParams],
    queryFn: () =>
      api.get('/api/analytics/revenue', { params: dateParams }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: topProducts, isLoading: topLoading } = useQuery<TopProduct[]>({
    queryKey: ['top-products', dateParams],
    queryFn: () =>
      api.get('/api/analytics/top-products', { params: dateParams }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentMethods, isLoading: paymentLoading } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods', dateParams],
    queryFn: () =>
      api.get('/api/analytics/payment-methods', { params: dateParams }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: ordersPerDay, isLoading: ordersLoading } = useQuery<OrdersPerDay[]>({
    queryKey: ['orders-per-day', dateParams],
    queryFn: () =>
      api.get('/api/analytics/orders-per-day', { params: dateParams }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: cashierPerformance, isLoading: cashierLoading } = useQuery<CashierPerformance[]>({
    queryKey: ['cashier-performance', dateParams],
    queryFn: () =>
      api
        .get('/api/analytics/cashier-performance', { params: dateParams })
        .then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">
            {t('dashboard.title')}
          </h1>
          <div className="gold-divider mt-2" />
        </div>

        {/* Date range picker */}
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

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title={t('dashboard.todayRevenue')}
          value={formatCurrency(kpis?.today_revenue || 0)}
          icon={DollarSign}
          isLoading={kpisLoading}
        />
        <KpiCard
          title={t('dashboard.monthRevenue')}
          value={formatCurrency(kpis?.month_revenue || 0)}
          icon={TrendingUp}
          isLoading={kpisLoading}
        />
        <KpiCard
          title={t('dashboard.grossProfit')}
          value={formatCurrency(kpis?.month_profit || 0)}
          icon={TrendingUp}
          isLoading={kpisLoading}
        />
        <KpiCard
          title={t('dashboard.totalSales')}
          value={kpis?.total_sales || 0}
          icon={ShoppingBag}
          isLoading={kpisLoading}
        />
        <KpiCard
          title={t('dashboard.pendingDeliveries')}
          value={kpis?.pending_deliveries || 0}
          icon={Truck}
          isLoading={kpisLoading}
        />
        <KpiCard
          title={t('dashboard.lowStockItems')}
          value={kpis?.low_stock_items || 0}
          icon={AlertTriangle}
          isLoading={kpisLoading}
          onClick={() => navigate('/inventory?lowStock=true')}
          variant="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.dailyRevenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <RevenueChart data={revenue || []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.topSellers')}</CardTitle>
          </CardHeader>
          <CardContent>
            {topLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <TopProductsChart data={topProducts || []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.paymentMethods')}</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <PaymentPieChart data={paymentMethods || []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.ordersPerDay')}</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <OrdersAreaChart data={ordersPerDay || []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cashier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.cashierRevenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            {cashierLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <CashierPerformanceChart data={cashierPerformance || []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('dashboard.cashierStats')}</CardTitle>
          </CardHeader>
          <CardContent>
            {cashierLoading ? (
              <Skeleton className="h-[300px] w-full" />
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
                        <td colSpan={5} className="py-8 text-center text-muted">
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
    </div>
  );
}
