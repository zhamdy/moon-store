export interface WarrantyClaimRecord {
  id: number;
  sale_id?: number | null;
  product_id: number;
  customer_id?: number | null;
  customer_name: string;
  customer_phone: string;
  issue_description: string;
  resolution?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
  product_name?: string;
  product_sku?: string;
}

export interface CreateWarrantyClaimDTO {
  sale_id?: number;
  product_id: number;
  customer_id?: number;
  customer_name: string;
  customer_phone: string;
  issue_description: string;
  resolution?: string;
}

export interface UpdateWarrantyClaimDTO {
  status?: string;
  resolution?: string;
}

export interface WarrantyFilters {
  status?: string;
  page: number;
  pageSize: number;
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';
const warrantyListQuerySchema = createListQuerySchema(['createdAt'] as const)
  .extend({ status: z.string().trim().min(1).max(30).optional() })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));
export function parseWarrantyListQuery(query: unknown): WarrantyFilters {
  const parsed = warrantyListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    status: parsed.status,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}
