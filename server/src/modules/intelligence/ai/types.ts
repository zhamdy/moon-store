export interface ForecastItem {
  productId: number;
  productName: string;
  categoryName: string;
  currentStock: number;
  minStock: number;
  price: number;
  dailyVelocity: number;
  forecast30d: number;
  daysOfStock: number;
  reorderRecommended: boolean;
  suggestedReorderQty: number;
  confidence: 'high' | 'medium' | 'low';
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

const aiListQuerySchema = createListQuerySchema(['value', 'name'] as const).strict();
const recommendationQuerySchema = createListQuerySchema(['value', 'name'] as const)
  .extend({ productId: z.string().regex(/^\d+$/).transform(Number).optional() })
  .strict();

export function parseAiListQuery(query: unknown) {
  const parsed = aiListQuerySchema.parse(query);
  return { page: parsed.page, pageSize: parsed.pageSize };
}

export function parseRecommendationQuery(query: unknown) {
  const parsed = recommendationQuerySchema.parse(query);
  return { page: parsed.page, pageSize: parsed.pageSize, productId: parsed.productId };
}

export interface ForecastResult {
  period: string;
  generatedAt: string;
  forecasts: ForecastItem[];
}

export interface ProductRecommendation {
  recommended_product_id: number;
  product_name: string;
  price: number | string;
  stock: number;
  image_url: string | null;
  category_name: string;
  co_occurrence_count: number;
}

export interface TopPairRecommendation {
  product_a_id: number;
  product_a_name: string;
  product_b_id: number;
  product_b_name: string;
  frequency: number;
}

export interface RecommendationsResult {
  sourceProductId?: number;
  recommendations?: ProductRecommendation[];
  topPairs?: TopPairRecommendation[];
}

export interface PricingSuggestion {
  productId: number;
  productName: string;
  category: string;
  currentPrice: number | string;
  costPrice: number | string;
  stock: number;
  type: 'markdown' | 'markup';
  reason: string;
  suggestedPrice: number;
  potentialImpact: string;
}

export interface ChurnRiskCustomer {
  customerId: number;
  customerName: string;
  phone: string | null;
  loyaltyPoints: number;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  churnRisk: 'high' | 'medium' | 'low';
  recommendedAction: string;
}

export interface ChurnRiskResult {
  atRiskCount: number;
  customers: ChurnRiskCustomer[];
}

export interface Anomaly {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface AnomaliesResult {
  totalAnomalies: number;
  anomalies: Anomaly[];
}

export interface RawSalesHistoryRow {
  product_id: number;
  product_name: string;
  current_stock: number;
  min_stock: number;
  price: number | string;
  category_name: string;
  total_sold_90d: number;
  daily_velocity: string | number;
}

export interface RawCoPurchasedRow {
  recommended_product_id: number;
  product_name: string;
  price: string | number;
  stock: number;
  image_url: string | null;
  category_name: string;
  co_occurrence_count: number;
}

export interface RawTopPairRow {
  product_a_id: number;
  product_a_name: string;
  product_b_id: number;
  product_b_name: string;
  frequency: number;
}

export interface RawDeadStockRow {
  id: number;
  name: string;
  price: string | number;
  cost_price: string | number;
  stock: number;
  category_name: string;
  sales_30d: number;
}

export interface RawFastMoverRow {
  id: number;
  name: string;
  price: string | number;
  cost_price: string | number;
  stock: number;
  category_name: string;
  sales_30d: number;
}

export interface RawCustomerOrderRow {
  id: number;
  name: string;
  phone: string | null;
  loyalty_points: number;
  total_orders: number;
  total_spent: string | number;
  last_order_date: string;
  days_since_last_order: string | number;
}

export interface RawHighDiscountRow {
  id: number;
  receipt_number: string;
  total: number;
  discount: number;
  subtotal: number;
  cashier_name: string | null;
  created_at: string;
}

export interface RawLargeReturnRow {
  id: number;
  product_id: number;
  product_name: string;
  delta: number;
  reason: string;
  user_name: string | null;
  created_at: string;
}

export interface RawCashierRefundRow {
  cashier_name: string;
  total_sales: number;
  refunded_count: number;
  total_refunded_amount: string | number;
}
