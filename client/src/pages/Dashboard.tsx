import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  isLoading: boolean;
}

function KpiCard({ title, value, icon: Icon, isLoading }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest font-body">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p className="text-2xl font-semibold text-foreground font-data mt-1">{value}</p>
            )}
          </div>
          <div className="h-12 w-12 rounded-md bg-gold/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-gold" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const { t } = useTranslation();

  const dateParams = dateRange.from && dateRange.to
    ? { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') }
    : {};

  const { data: kpis, isLoading: kpisLoading } = useQuery<KpiData>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api.get('/api/analytics/dashboard').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery<RevenueDataPoint[]>({
    queryKey: ['revenue', dateParams],
    queryFn: () => api.get('/api/analytics/revenue', { params: dateParams }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: topProducts, isLoading: topLoading } = useQuery<TopProduct[]>({
    queryKey: ['top-products', dateParams],
    queryFn: () => api.get('/api/analytics/top-products', { params: dateParams }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentMethods, isLoading: paymentLoading } = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods', dateParams],
    queryFn: () => api.get('/api/analytics/payment-methods', { params: dateParams }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: ordersPerDay, isLoading: ordersLoading } = useQuery<OrdersPerDay[]>({
    queryKey: ['orders-per-day', dateParams],
    queryFn: () => api.get('/api/analytics/orders-per-day', { params: dateParams }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-wider text-foreground">{t('dashboard.title')}</h1>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
    </div>
  );
}
