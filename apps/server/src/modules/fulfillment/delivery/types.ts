import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

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
  sortBy: 'createdAt' | 'estimatedDelivery';
  sortOrder: 'asc' | 'desc';
}

export interface DeliveryListResult {
  orders: Record<string, any>[];
  total: number;
}

export const deliveryListQuerySchema = createListQuerySchema([
  'createdAt',
  'estimatedDelivery',
] as const)
  .extend({
    status: z.string().trim().min(1).max(30).optional(),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));
export function parseDeliveryListQuery(query: unknown): DeliveryOrderFilters {
  const parsed = deliveryListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    status: parsed.status,
    search: parsed.search,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export interface DeliveryHistoryFilters {
  page: number;
  pageSize: number;
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export const deliveryHistoryQuerySchema = createListQuerySchema(['createdAt'] as const)
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseDeliveryHistoryQuery(query: unknown): DeliveryHistoryFilters {
  const parsed = deliveryHistoryQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export interface PerformanceResult {
  totalDelivered: number;
  avgDeliveryDays: number;
  pendingCount: number;
  shippedCount: number;
  companyStats: Record<string, any>[];
}
