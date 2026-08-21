export type DeliveryStatus = 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface DeliveryOrderItemInput {
  product_id: number;
  quantity: number;
}

export interface DeliveryOrderInput {
  customer_id?: number | null;
  customer_name: string;
  phone: string;
  address: string;
  notes?: string | null;
  items: DeliveryOrderItemInput[];
  estimated_delivery?: string | null;
  shipping_company_id?: number | null;
  tracking_number?: string | null;
  shipping_cost?: number | null;
}

export interface StatusUpdateInput {
  status: DeliveryStatus;
  notes?: string | null;
}

export interface DeliveryOrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface DeliveryListResult {
  orders: Record<string, any>[];
  meta: { total: number; page: number; limit: number };
}

export interface PerformanceResult {
  totalDelivered: number;
  avgDeliveryDays: number;
  pendingCount: number;
  shippedCount: number;
  companyStats: Record<string, any>[];
}
