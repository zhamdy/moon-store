export type DeliveryStatus = 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface DeliveryOrderItemInput {
  product_id: number;
  quantity: number;
}

export interface DeliveryOrderInput {
  customer_id?: number | null;
  customer_name: string;
  phone: string;
  address: string;
  notes?: string | null;
  items: DeliveryOrderItemInput[];
  estimated_delivery?: string | null;
  shipping_company_id?: number | null;
  tracking_number?: string | null;
  shipping_cost?: number | null;
}

export interface StatusUpdateInput {
  status: DeliveryStatus;
  notes?: string | null;
}

export interface DeliveryOrderFilters {
  page: number;
  pageSize: number;
  status?: string;
  search?: string;
}

export interface DeliveryListResult {
  orders: Record<string, any>[];
  total: number;
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';
const deliveryListQuerySchema = createListQuerySchema(['createdAt', 'estimatedDelivery'] as const)
  .extend({
    status: z.string().trim().min(1).max(30).optional(),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export function parseDeliveryListQuery(query: unknown): DeliveryOrderFilters {
  const parsed = deliveryListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    status: parsed.status,
    search: parsed.search,
  };
}

export interface DeliveryHistoryFilters {
  page: number;
  pageSize: number;
}

const deliveryHistoryQuerySchema = createListQuerySchema(['createdAt'] as const).strict();

export function parseDeliveryHistoryQuery(query: unknown): DeliveryHistoryFilters {
  const parsed = deliveryHistoryQuerySchema.parse(query);
  return { page: parsed.page, pageSize: parsed.pageSize };
}

export interface PerformanceResult {
  totalDelivered: number;
  avgDeliveryDays: number;
  pendingCount: number;
  shippedCount: number;
  companyStats: Record<string, any>[];
}
