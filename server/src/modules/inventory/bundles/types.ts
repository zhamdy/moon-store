import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

export interface BundleRecord {
  id: number;
  name: string;
  description?: string | null;
  bundle_price: number;
  starts_at?: string | null;
  expires_at?: string | null;
  status: string;
  item_count?: number;
  original_price?: number;
  created_at: string;
  updated_at: string;
}

export interface BundleItemRecord {
  id: number;
  bundle_id: number;
  product_id: number;
  quantity: number;
  product_name?: string;
  sku?: string;
  original_price?: number;
  stock?: number;
  image_url?: string | null;
}

export interface BundleDetailRecord extends BundleRecord {
  items: BundleItemRecord[];
}

export interface BundleItemDTO {
  product_id: number;
  quantity?: number;
}

export interface CreateBundleDTO {
  name: string;
  description?: string | null;
  bundle_price: number;
  starts_at?: string | null;
  expires_at?: string | null;
  items: BundleItemDTO[];
}

export type UpdateBundleDTO = CreateBundleDTO;

export interface BundleFilters {
  status?: 'active' | 'inactive';
  page: number;
  pageSize: number;
  sortBy: 'createdAt' | 'name';
  sortOrder: 'asc' | 'desc';
}

export const bundleListQuerySchema = createListQuerySchema(['createdAt', 'name'] as const)
  .extend({ status: z.enum(['active', 'inactive']).optional() })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

/** Shapes the parsed query into what the service takes; see the products module. */
export function normalizeBundleListQuery(
  parsed: z.infer<typeof bundleListQuerySchema>
): BundleFilters {
  return {
    status: parsed.status,
    page: parsed.page,
    pageSize: parsed.pageSize,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export function parseBundleListQuery(query: unknown): BundleFilters {
  return normalizeBundleListQuery(bundleListQuerySchema.parse(query));
}
