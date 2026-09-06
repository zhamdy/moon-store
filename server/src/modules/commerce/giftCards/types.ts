import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

export interface GiftCardFilters {
  page: number;
  pageSize: number;
  status?: 'active' | 'cancelled' | 'redeemed';
  search?: string;
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export interface GiftCardListResult {
  rows: Record<string, any>[];
  total: number;
  page: number;
}

export const giftCardListQuerySchema = createListQuerySchema(['createdAt'] as const)
  .extend({
    status: z.enum(['active', 'cancelled', 'redeemed']).optional(),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));
export const giftCardTransactionQuerySchema = createListQuerySchema(['createdAt'] as const)
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseGiftCardListQuery(query: unknown): GiftCardFilters {
  const parsed = giftCardListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    status: parsed.status,
    search: parsed.search,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export function parseGiftCardTransactionQuery(query: unknown): {
  page: number;
  pageSize: number;
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
} {
  const parsed = giftCardTransactionQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export interface CreateGiftCardInput {
  code?: string;
  initial_value: number;
  customer_id?: number | null;
  expires_at?: string | null;
}

export interface GiftCardBalanceResult {
  code: string;
  balance: number;
  initial_value: number;
  status: string;
  expires_at: string | null;
  is_expired: boolean;
  is_redeemable: boolean;
}

export interface RedeemResult {
  transaction: Record<string, any>;
  new_balance: number;
  code: string;
}
