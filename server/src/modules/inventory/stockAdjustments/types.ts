export interface StockAdjustmentRecord {
  id: number;
  product_id: number;
  previous_qty: number;
  new_qty: number;
  delta: number;
  reason: string;
  user_id: number;
  created_at: string;
  product_name?: string;
  product_sku?: string;
  user_name?: string;
}

export interface StockAdjustmentFilters {
  page?: number;
  limit?: number;
}
