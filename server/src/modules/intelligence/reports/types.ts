export interface SalesReportFilters {
  from?: unknown;
  to?: unknown;
  groupBy?: 'day' | 'month' | 'hour' | string;
  cashierId?: unknown;
  paymentMethod?: unknown;
  page?: number | string;
  limit?: number | string;
}

export interface SalesReportSummary {
  total_sales: string | number;
  total_discount: string | number;
  total_tax: string | number;
  total_orders: number;
  avg_order_value: string | number;
}

export interface SalesReportGroupedItem {
  period: string;
  orders: number;
  subtotal: string | number;
  discount: string | number;
  tax: string | number;
  total: string | number;
}

export interface SalesReportTransaction extends Record<string, unknown> {
  id: number;
  receipt_number: string;
  cashier_name?: string;
  customer_name?: string;
  item_count?: number;
  total: number;
  subtotal: number;
  discount: number;
  tax: number;
  payment_method: string;
  status: string;
  created_at: string;
}

export interface SalesReportData {
  summary: SalesReportSummary;
  grouped: SalesReportGroupedItem[];
  transactions: Record<string, unknown>[];
}

export interface InventoryReportFilters {
  categoryId?: unknown;
  distributorId?: unknown;
  lowStockOnly?: string | boolean;
}

export interface InventoryReportSummary {
  total_products: number;
  total_units: string | number;
  total_retail_value: string | number;
  total_cost_value: string | number;
  potential_profit: string | number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export interface InventoryReportCategoryItem {
  category_name: string;
  product_count: number;
  total_units: string | number;
  retail_value: string | number;
  cost_value: string | number;
}

export interface InventoryReportData {
  summary: InventoryReportSummary;
  byCategory: InventoryReportCategoryItem[];
}

export interface ProfitLossFilters {
  from?: unknown;
  to?: unknown;
}

export interface ProfitLossRevenue {
  gross: number;
  discount: number;
  net: number;
  tax: number;
}

export interface ProfitLossOperatingExpenses {
  total: number;
  breakdown: Array<{ category: string; total: string | number; count: number }>;
}

export interface ProfitLossData {
  revenue: ProfitLossRevenue;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: ProfitLossOperatingExpenses;
  netProfit: number;
  netMargin: number;
}
