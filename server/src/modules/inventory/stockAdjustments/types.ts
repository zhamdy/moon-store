export interface StockAdjustmentRecord {
  id: number;
  product_id: number;
  previous_qty: number;
  new_qty: number;
  delta: number;
  reason: string;
  user_id: number;
  created_at: string;
  product_name?: string;
  product_sku?: string;
  user_name?: string;
}

export interface StockAdjustmentFilters {
  page: number;
  pageSize: number;
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
}

import { createListQuerySchema } from '../../../http/pagination';

const stockAdjustmentListQuerySchema = createListQuerySchema(['createdAt'] as const)
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseStockAdjustmentListQuery(query: unknown): StockAdjustmentFilters {
  const parsed = stockAdjustmentListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}
