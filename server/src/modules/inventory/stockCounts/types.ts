export interface StockCountRecord {
  id: number;
  category_id?: number | null;
  notes?: string | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  created_by: number;
  created_at: string;
  completed_at?: string | null;
  created_by_name?: string;
  category_name?: string | null;
  total_items?: number;
  counted_items?: number;
  total_variance?: number;
}

export interface StockCountItemRecord {
  id: number;
  count_id: number;
  product_id: number;
  variant_id?: number | null;
  expected_qty: number;
  counted_qty?: number | null;
  variance?: number | null;
  notes?: string | null;
  product_name?: string;
  product_sku?: string;
  product_barcode?: string | null;
  price?: number;
  cost_price?: number;
  variant_sku?: string | null;
  variant_barcode?: string | null;
  variant_attributes?: Record<string, any> | string | null;
}

export interface StockCountDetail extends StockCountRecord {
  items: StockCountItemRecord[];
}

export interface CreateStockCountDTO {
  category_id?: number;
  notes?: string;
}

export interface UpdateStockCountItemDTO {
  counted_qty: number;
  notes?: string;
}

export interface CompleteStockCountDTO {
  apply_adjustments?: boolean;
}

export interface StockCountFilters {
  page: number;
  pageSize: number;
  status?: 'in_progress' | 'completed' | 'cancelled';
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

const stockCountListQuerySchema = createListQuerySchema(['createdAt'] as const)
  .extend({ status: z.enum(['in_progress', 'completed', 'cancelled']).optional() })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseStockCountListQuery(query: unknown): StockCountFilters {
  const parsed = stockCountListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    status: parsed.status,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}
