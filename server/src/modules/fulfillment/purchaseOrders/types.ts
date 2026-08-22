export type PurchaseOrderStatus =
  | 'Draft'
  | 'Sent'
  | 'Partially Received'
  | 'Received'
  | 'Cancelled';

export interface POItemDTO {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  cost_price: number;
}

export interface CreatePurchaseOrderDTO {
  distributor_id: number;
  items: POItemDTO[];
  notes?: string | null;
}

export interface ReceiveItemInput {
  item_id: number;
  quantity: number;
}

export interface ReceiveItemsDTO {
  items: ReceiveItemInput[];
}

export interface PurchaseOrderFilters {
  page: number;
  pageSize: number;
  distributorId?: number;
  status?: string;
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';
const purchaseOrderListQuerySchema = createListQuerySchema(['createdAt'] as const)
  .extend({
    distributorId: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.string().trim().min(1).max(30).optional(),
  })
  .strict();
export function parsePurchaseOrderListQuery(query: unknown): PurchaseOrderFilters {
  const parsed = purchaseOrderListQuerySchema.parse(query);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    distributorId: parsed.distributorId,
    status: parsed.status,
  };
}

export interface PurchaseOrderListResult {
  rows: Record<string, any>[];
  total: number;
}
