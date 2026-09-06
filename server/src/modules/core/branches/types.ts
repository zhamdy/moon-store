import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

export interface Branch {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  is_main: number | boolean;
  created_at?: string;
  updated_at?: string;
  product_count?: number;
  total_stock?: number;
}

export interface BranchStats {
  products: number;
  stock: number;
}

export interface ConsolidatedBranch {
  id: number;
  name: string;
  code: string;
  is_main: number | boolean;
  stats: BranchStats;
}

export interface CreateBranchDTO {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  is_main?: boolean;
}

export interface UpdateBranchDTO {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  is_main?: boolean;
}

export interface BranchTransfer {
  id: number;
  source_branch_id: number;
  target_branch_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  notes?: string | null;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled' | string;
  created_by?: number | null;
  created_at?: string;
  completed_at?: string | null;
  source_branch?: string;
  target_branch?: string;
  product_name?: string;
  product_sku?: string;
  created_by_name?: string | null;
}

export interface CreateTransferDTO {
  source_branch_id: number;
  target_branch_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  notes?: string;
}

export interface TransferFilters {
  status?: string;
  page: number;
  pageSize: number;
  sortBy: 'createdAt' | 'status';
  sortOrder: 'asc' | 'desc';
}

export const transferListQuerySchema = createListQuerySchema(['createdAt', 'status'] as const)
  .extend({
    status: z.enum(['pending', 'in_transit', 'completed', 'cancelled']).optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseTransferListQuery(query: unknown): TransferFilters {
  return transferListQuerySchema.parse(query);
}
