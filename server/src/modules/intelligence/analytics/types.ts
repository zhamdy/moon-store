export interface DashboardKpis {
  today_revenue: number;
  month_revenue: number;
  month_profit: number;
  total_sales: number;
  pending_deliveries: number;
  low_stock_items: number;
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

const dateFilters = {
  from: z.string().date().optional(),
  to: z.string().date().optional(),
};
const analyticsDateQuerySchema = z.object(dateFilters).strict();
const analyticsPageQuerySchema = createListQuerySchema(['value', 'name'] as const)
  .extend(dateFilters)
  .strict();
const analyticsDaysPageQuerySchema = createListQuerySchema(['value', 'name'] as const)
  .extend({
    days: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(3650))
      .optional(),
  })
  .strict();

export interface AnalyticsPageQuery {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
}

export function parseAnalyticsDateQuery(query: unknown) {
  return analyticsDateQuerySchema.parse(query);
}

export function parseAnalyticsPageQuery(query: unknown): AnalyticsPageQuery {
  const parsed = analyticsPageQuerySchema.parse(query);
  return { page: parsed.page, pageSize: parsed.pageSize, from: parsed.from, to: parsed.to };
}

export function parseAnalyticsDaysPageQuery(query: unknown, defaultDays: number) {
  const parsed = analyticsDaysPageQuerySchema.parse(query);
  return { page: parsed.page, pageSize: parsed.pageSize, days: parsed.days ?? defaultDays };
}

export interface RevenueByDate {
  date: string;
  revenue: number;
}

export interface TopProduct {
  name: string;
  total_sold: number;
  total_revenue: number;
}

export interface PaymentMethodRow {
  payment_method: string;
  count: number;
  revenue: number;
}

export interface OrdersPerDay {
  date: string;
  orders: number;
}

export interface CashierPerformanceRow {
  cashier_id: number;
  cashier_name: string;
  total_sales: number;
  total_revenue: number;
  avg_order_value: number;
  total_items: number;
}

export interface SalesByCategoryRow {
  category_name: string;
  total_sold: number;
  revenue: number;
}

export interface SalesByDistributorRow {
  distributor_name: string;
  total_sold: number;
  revenue: number;
}

export interface AbcProduct {
  id: number;
  name: string;
  sku: string;
  stock: number;
  price: number;
  abc_class: string;
  revenue: number;
  units_sold: number;
  revenue_pct?: number;
  cumulative_pct?: number;
}

export interface AbcClassificationResult {
  products: AbcProduct[];
  summary: {
    total_revenue: number;
    a_count: number;
    b_count: number;
    c_count: number;
  };
}

export interface ReorderProduct {
  id: number;
  name: string;
  sku: string;
  stock: number;
  min_stock: number;
  price: number;
  cost_price: number;
  lead_time_days: number;
  reorder_qty: number;
  sold_last_30d: number;
}

export interface ReorderSuggestion extends ReorderProduct {
  daily_velocity: number;
  days_of_stock: number;
  suggested_qty: number;
  estimated_cost: number;
}

export interface InventorySnapshot {
  id: number;
  total_products: number;
  total_units: number;
  total_cost_value: number;
  total_retail_value: number;
  snapshot_data?: string;
  created_at: string;
}

export interface DeadStockProduct {
  id: number;
  name: string;
  sku: string;
  category: string;
  stock: number;
  price: number;
  cost_price: number;
  tied_up_capital: number;
  last_sold_date: string | null;
  days_inactive: number;
}

export interface DeadStockResult {
  products: DeadStockProduct[];
  summary: {
    total_products: number;
    total_tied_up_capital: number;
  };
}

export interface CustomerLtvRow {
  id: number;
  name: string;
  phone: string;
  order_count: number;
  lifetime_revenue: number;
  avg_order_value: number;
  first_purchase: string;
  last_purchase: string;
  tenure_days: number;
  recency_days: number;
}

export interface CustomerLtvResult {
  customers: CustomerLtvRow[];
  summary: {
    total_customers: number;
    avg_ltv: number;
    top10_revenue_share: number;
  };
}

export interface HourlyHeatmapRow {
  day_of_week: number;
  hour: number;
  order_count: number;
  revenue: number;
}

export interface DashboardAllData {
  kpis: DashboardKpis;
  revenue: RevenueByDate[];
  topProducts: TopProduct[];
  paymentMethods: PaymentMethodRow[];
  ordersPerDay: OrdersPerDay[];
  cashierPerformance: CashierPerformanceRow[];
  categorySales: SalesByCategoryRow[];
  distributorSales: SalesByDistributorRow[];
}
