export interface ReturnedItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  price: number;
  reason: string;
  condition?: 'good' | 'damaged' | 'defective';
}

export interface NewItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  price: number;
}

export interface CreateExchangeDTO {
  original_sale_id: number;
  returned_items: ReturnedItemInput[];
  new_items: NewItemInput[];
  payment_method?: 'cash' | 'card' | 'store_credit';
  notes?: string;
}

export interface ExchangeFilters {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: 'createdAt' | 'exchangeNumber' | 'difference';
  sortOrder: 'asc' | 'desc';
}

const exchangeListQuerySchema = createListQuerySchema([
  'createdAt',
  'exchangeNumber',
  'difference',
] as const)
  .extend({ search: z.string().trim().min(1).max(100).optional() })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseExchangeListQuery(query: unknown): ExchangeFilters {
  return exchangeListQuerySchema.parse(query);
}

export interface ExchangeRow {
  id: number;
  exchange_number: string;
  original_sale_id: number;
  customer_id: number | null;
  cashier_id: number;
  return_total: number;
  new_total: number;
  difference: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  cashier_name?: string;
  customer_name?: string;
  original_receipt?: string;
}

export interface ReturnedItemRow {
  id: number;
  exchange_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  price: number;
  reason: string;
  condition: string;
  product_name?: string;
  sku?: string;
}

export interface NewItemRow {
  id: number;
  exchange_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  price: number;
  product_name?: string;
  sku?: string;
}

export interface ExchangeDetail extends ExchangeRow {
  returned_items: ReturnedItemRow[];
  new_items: NewItemRow[];
}
import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';
