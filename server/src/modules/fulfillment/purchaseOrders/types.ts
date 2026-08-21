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
  page?: number;
  limit?: number;
  distributor_id?: number | string;
  status?: string;
}

export interface PurchaseOrderListResult {
  rows: Record<string, any>[];
  total: number;
}
