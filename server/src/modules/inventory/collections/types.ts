export interface CollectionRecord {
  id: number;
  name: string;
  description?: string | null;
  season?: string | null;
  is_featured: number | boolean;
  product_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface CollectionProductRecord {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock: number;
  category?: string | null;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
  image_url?: string | null;
  status: string;
  position: number;
  [key: string]: any;
}

export interface CollectionDetailRecord extends CollectionRecord {
  products: CollectionProductRecord[];
}

export interface CreateCollectionDTO {
  name: string;
  description?: string | null;
  season?: string | null;
  is_featured?: boolean;
  product_ids?: number[];
}

export type UpdateCollectionDTO = CreateCollectionDTO;

export interface CollectionFilters {
  season?: string;
  featured?: boolean;
  page: number;
  pageSize: number;
  sortBy: 'createdAt' | 'name';
  sortOrder: 'asc' | 'desc';
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

const collectionListQuerySchema = createListQuerySchema(['createdAt', 'name'] as const)
  .extend({
    season: z.string().trim().min(1).max(50).optional(),
    featured: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseCollectionListQuery(query: unknown): CollectionFilters {
  const parsed = collectionListQuerySchema.parse(query);
  return {
    season: parsed.season,
    featured: parsed.featured,
    page: parsed.page,
    pageSize: parsed.pageSize,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}
