export interface CouponFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: 'active' | 'inactive' | 'expired';
  sortBy: 'createdAt' | 'code';
  sortOrder: 'asc' | 'desc';
}

export interface CouponListResult {
  coupons: Record<string, any>[];
  total: number;
  page: number;
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

const couponListQuerySchema = createListQuerySchema(['createdAt', 'code'] as const)
  .extend({
    search: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['active', 'inactive', 'expired']).optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseCouponListQuery(query: unknown): CouponFilters {
  const parsed = couponListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    status: parsed.status,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export interface CouponData {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase?: number | null;
  max_discount?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  max_uses_per_customer?: number | null;
  scope: 'all' | 'category' | 'product';
  scope_ids?: number[] | null;
  stackable: boolean;
}

export interface ValidateCouponInput {
  code: string;
  subtotal: number;
  customer_id?: number | null;
  item_product_ids?: number[] | null;
}

export interface ValidateCouponResult {
  coupon_id: number;
  code: string;
  type: string;
  value: number;
  discount: number;
  stackable: boolean;
}

export class CouponError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'CouponError';
  }
}
