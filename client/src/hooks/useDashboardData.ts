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

interface DashboardAllData {
  kpis: KpiData;
  revenue: RevenueDataPoint[];
  topProducts: TopProduct[];
  paymentMethods: PaymentMethod[];
  ordersPerDay: OrdersPerDay[];
  cashierPerformance: CashierPerformance[];
  categorySales: CategorySales[];
  distributorSales: DistributorSales[];
}

export function useDashboardData(dateParams: Record<string, string>) {
  const query = useQuery<DashboardAllData>({
    queryKey: ['dashboard-all', dateParams],
    queryFn: () =>
      api.get('/api/v1/analytics/dashboard-all', { params: dateParams }).then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  const d = query.data;

  return {
    kpis: d?.kpis,
    kpisLoading: query.isLoading,
    revenue: d?.revenue,
    revenueLoading: query.isLoading,
    topProducts: d?.topProducts,
    topLoading: query.isLoading,
    paymentMethods: d?.paymentMethods,
    paymentLoading: query.isLoading,
    ordersPerDay: d?.ordersPerDay,
    ordersLoading: query.isLoading,
    cashierPerformance: d?.cashierPerformance,
    cashierLoading: query.isLoading,
    categorySales: d?.categorySales,
    categoryLoading: query.isLoading,
    distributorSales: d?.distributorSales,
    distributorLoading: query.isLoading,
  };
}
