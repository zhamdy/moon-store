import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

export interface CustomerRecord {
  id: number;
  name: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerDTO {
  name: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
}

export type UpdateCustomerDTO = CreateCustomerDTO;

export interface CustomerFilters {
  search?: string;
  page: number;
  pageSize: number;
  sortBy: 'name' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

export const customerListQuerySchema = createListQuerySchema(['name', 'createdAt'] as const)
  .extend({ search: z.string().trim().min(1).max(100).optional() })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'name', ...query }));

export const customerSalesQuerySchema = createListQuerySchema(['createdAt'] as const)
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseCustomerListQuery(query: unknown): CustomerFilters {
  const parsed = customerListQuerySchema.parse(query);
  return {
    search: parsed.search,
    page: parsed.page,
    pageSize: parsed.pageSize,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export function parseCustomerSalesQuery(query: unknown): {
  page: number;
  pageSize: number;
  sortBy: 'createdAt';
  sortOrder: 'asc' | 'desc';
} {
  const parsed = customerSalesQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}

export interface CustomerStats {
  total_spent: number;
  order_count: number;
  avg_order: number;
  last_purchase: string | null;
}
