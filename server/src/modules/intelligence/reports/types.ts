import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

export interface SalesReportFilters {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'month' | 'hour';
  cashierId?: number;
  paymentMethod?: string;
  page: number;
  pageSize: number;
}

export const salesReportQuerySchema = createListQuerySchema(['createdAt', 'total'] as const)
  .extend({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    groupBy: z.enum(['day', 'month', 'hour']).default('day'),
    cashierId: z.string().regex(/^\d+$/).transform(Number).optional(),
    paymentMethod: z.string().trim().min(1).max(30).optional(),
  })
  .strict();

export function parseSalesReportQuery(query: unknown): SalesReportFilters {
  const parsed = salesReportQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    from: parsed.from,
    to: parsed.to,
    groupBy: parsed.groupBy,
    cashierId: parsed.cashierId,
    paymentMethod: parsed.paymentMethod,
  };
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

export const inventoryReportQuerySchema = z
  .object({
    categoryId: z.string().regex(/^\d+$/).transform(Number).optional(),
    distributorId: z.string().regex(/^\d+$/).transform(Number).optional(),
    lowStockOnly: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();
export const profitLossQuerySchema = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .strict();

export function parseInventoryReportQuery(query: unknown): InventoryReportFilters {
  return inventoryReportQuerySchema.parse(query);
}

export function parseProfitLossQuery(query: unknown): ProfitLossFilters {
  return profitLossQuerySchema.parse(query);
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
