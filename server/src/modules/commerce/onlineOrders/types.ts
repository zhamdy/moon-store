export interface OrderItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  price: number;
}

export interface CreateOnlineOrderDTO {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  shipping_address: string;
  city: string;
  notes?: string | null;
  items: OrderItemInput[];
  shipping_fee?: number;
}

export interface OnlineOrderFilters {
  status?: string;
  payment_status?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface OnlineOrderItemRecord {
  id: number;
  order_id: number;
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  price: number;
  product_name?: string;
  sku?: string;
  image_url?: string | null;
  variant_sku?: string | null;
  variant_attributes?: any;
}

export interface OnlineOrderRecord {
  id: number;
  order_number: string;
  customer_id?: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  shipping_address: string;
  city: string;
  subtotal: number;
  shipping_fee: number;
  total: number;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  item_count?: number;
  items?: OnlineOrderItemRecord[];
}
