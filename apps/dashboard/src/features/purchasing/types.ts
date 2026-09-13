// Types owned by the purchasing slice. Cross-slice contracts (Product,
// Distributor, ...) live in `shared/types` instead.

/** Purchase order row from GET /api/v1/purchase-orders */
export interface PurchaseOrder {
  id: number;
  po_number: string;
  distributor_id: number;
  distributor_name: string;
  status: string;
  total: number;
  notes: string | null;
  item_count: number;
  created_by_name: string;
  created_at: string;
}

/** One ordered line of GET /api/v1/purchase-orders/:id */
export interface PurchaseOrderItem {
  id: number;
  po_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  received_quantity: number;
  cost_price: number;
  product_name: string;
  product_sku: string;
  variant_sku: string | null;
  variant_attributes: Record<string, string> | null;
}

/** GET /api/v1/purchase-orders/:id — the list row plus its lines */
export interface PurchaseOrderDetail extends PurchaseOrder {
  items: PurchaseOrderItem[];
}

/** One suggestion from GET /api/v1/purchase-orders/auto-generate */
export interface LowStockSuggestion {
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

/** A line being composed in the purchase-order form, before it is sent */
export interface PurchaseOrderLine {
  product_id: number;
  product_name: string;
  quantity: number;
  cost_price: number;
}
