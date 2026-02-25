import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface KpiData {
  today_revenue: number;
  month_revenue: number;
  month_profit: number;
  total_sales: number;
  pending_deliveries: number;
  low_stock_items: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export interface TopProduct {
  name: string;
  total_sold: number;
}

export interface PaymentMethod {
  payment_method: string;
  count: number;
  revenue: number;
}

export interface OrdersPerDay {
  date: string;
  orders: number;
}

export interface CashierPerformance {
  cashier_id: number;
  cashier_name: string;
  total_sales: number;
  total_revenue: number;
  avg_order_value: number;
  total_items: number;
}

export interface CategorySales {
  category_name: string;
  total_sold: number;
  revenue: number;
}

export interface DistributorSales {
  distributor_name: string;
  total_sold: number;
  revenue: number;
}

export function useDashboardData(dateParams: Record<string, string>) {
  const staleTime = 5 * 60 * 1000;

  const kpisQuery = useQuery<KpiData>({
    queryKey: ['dashboard-kpis'],
    queryFn: () => api.get('/api/v1/analytics/dashboard').then((r) => r.data.data),
    staleTime,
  });

  const revenueQuery = useQuery<RevenueDataPoint[]>({
    queryKey: ['revenue', dateParams],
    queryFn: () =>
      api.get('/api/v1/analytics/revenue', { params: dateParams }).then((r) => r.data.data),
    staleTime,
  });

  const topProductsQuery = useQuery<TopProduct[]>({
    queryKey: ['top-products', dateParams],
    queryFn: () =>
      api.get('/api/v1/analytics/top-products', { params: dateParams }).then((r) => r.data.data),
    staleTime,
  });

  const paymentMethodsQuery = useQuery<PaymentMethod[]>({
    queryKey: ['payment-methods', dateParams],
    queryFn: () =>
      api.get('/api/v1/analytics/payment-methods', { params: dateParams }).then((r) => r.data.data),
    staleTime,
  });

  const ordersPerDayQuery = useQuery<OrdersPerDay[]>({
    queryKey: ['orders-per-day', dateParams],
    queryFn: () =>
      api.get('/api/v1/analytics/orders-per-day', { params: dateParams }).then((r) => r.data.data),
    staleTime,
  });

  const cashierQuery = useQuery<CashierPerformance[]>({
    queryKey: ['cashier-performance', dateParams],
    queryFn: () =>
      api
        .get('/api/v1/analytics/cashier-performance', { params: dateParams })
        .then((r) => r.data.data),
    staleTime,
  });

  const categoryQuery = useQuery<CategorySales[]>({
    queryKey: ['sales-by-category', dateParams],
    queryFn: () =>
      api
        .get('/api/v1/analytics/sales-by-category', { params: dateParams })
        .then((r) => r.data.data),
    staleTime,
  });

  const distributorQuery = useQuery<DistributorSales[]>({
    queryKey: ['sales-by-distributor', dateParams],
    queryFn: () =>
      api
        .get('/api/v1/analytics/sales-by-distributor', { params: dateParams })
        .then((r) => r.data.data),
    staleTime,
  });

  return {
    kpis: kpisQuery.data,
    kpisLoading: kpisQuery.isLoading,
    revenue: revenueQuery.data,
    revenueLoading: revenueQuery.isLoading,
    topProducts: topProductsQuery.data,
    topLoading: topProductsQuery.isLoading,
    paymentMethods: paymentMethodsQuery.data,
    paymentLoading: paymentMethodsQuery.isLoading,
    ordersPerDay: ordersPerDayQuery.data,
    ordersLoading: ordersPerDayQuery.isLoading,
    cashierPerformance: cashierQuery.data,
    cashierLoading: cashierQuery.isLoading,
    categorySales: categoryQuery.data,
    categoryLoading: categoryQuery.isLoading,
    distributorSales: distributorQuery.data,
    distributorLoading: distributorQuery.isLoading,
  };
}
