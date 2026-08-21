export interface PurchaseOrderItemDTO {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  cost_price: number;
}

export interface CreatePurchaseOrderDTO {
  distributor_id: number;
  notes?: string | null;
  items: PurchaseOrderItemDTO[];
}

export interface ReceiveItemDTO {
  item_id: number;
  quantity: number;
}

export interface ReceivePurchaseOrderDTO {
  items: ReceiveItemDTO[];
}

export interface PurchaseOrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  distributor_id?: number;
  search?: string;
}

export interface LowStockProductPO {
  product_id: number;
  name: string;
  sku: string;
  cost_price: number;
  stock: number;
  min_stock: number;
  distributor_id: number;
  distributor_name: string;
  suggested_qty: number;
}
