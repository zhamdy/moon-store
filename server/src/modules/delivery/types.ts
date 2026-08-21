export interface DeliveryOrderRecord {
  id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  notes?: string | null;
  customer_id?: number | null;
  estimated_delivery?: string | null;
  shipping_company_id?: number | null;
  tracking_number?: string | null;
  shipping_cost?: number;
  created_at: string;
  updated_at: string;
  items?: Record<string, any>[];
}

export interface DeliveryItemDTO {
  product_id: number;
  quantity: number;
}

export interface CreateDeliveryOrderDTO {
  customer_id?: number | null;
  customer_name: string;
  phone: string;
  address: string;
  notes?: string | null;
  items: DeliveryItemDTO[];
  estimated_delivery?: string | null;
  shipping_company_id?: number | null;
  tracking_number?: string | null;
  shipping_cost?: number | null;
}

export type UpdateDeliveryOrderDTO = CreateDeliveryOrderDTO;

export interface UpdateDeliveryStatusDTO {
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  notes?: string | null;
}

export interface DeliveryOrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}
