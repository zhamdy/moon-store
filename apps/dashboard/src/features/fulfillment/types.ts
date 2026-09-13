// Types owned by the fulfillment slice. Cross-slice contracts (Product,
// Customer, ...) live in `shared/types` instead.

import type { Product } from '../../shared/types';

/** A delivery order's lifecycle state, exactly as PUT /api/v1/delivery/:id/status accepts it */
export type DeliveryStatus = 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';

/** Shipping company from GET /api/v1/shipping-companies */
export interface ShippingCompany {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  created_at: string;
}

/** Delivery order row from GET /api/v1/delivery */
export interface DeliveryOrder {
  id: number;
  order_number: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string | null;
  status: DeliveryStatus;
  shipping_company_id: number | null;
  shipping_company_name: string | null;
  tracking_number: string | null;
  shipping_cost: number;
  estimated_delivery: string | null;
  created_at: string;
  updated_at: string;
}

/** One entry of GET /api/v1/delivery/:id/history */
export interface DeliveryStatusHistoryEntry {
  id: number;
  order_id: number;
  status: string;
  notes: string | null;
  changed_by_name: string | null;
  created_at: string;
}

/** GET /api/v1/delivery/analytics/performance */
export interface DeliveryPerformance {
  totalDelivered: number;
  avgDeliveryDays: number;
  pendingCount: number;
  shippedCount: number;
  companyStats: Array<{
    id: number;
    name: string;
    total_orders: number;
    delivered: number;
    cancelled: number;
    avg_days: number | null;
  }>;
}

/** Body of POST /api/v1/delivery and PUT /api/v1/delivery/:id */
export interface DeliveryPayload {
  customer_id: number | null;
  customer_name: string;
  phone: string;
  address: string;
  notes?: string;
  estimated_delivery: string | null;
  shipping_company_id: number | null;
  tracking_number: string | null;
  shipping_cost: number | null;
  items: Array<{ product_id: number; quantity: number }>;
}

/** A line on an online order, from GET /api/v1/online-orders/:id. */
export interface OnlineOrderItem {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

/** An order from GET /api/v1/online-orders; `items` only on the single read. */
export interface OnlineOrder {
  id: number;
  order_number: string;
  customer_name: string;
  status: string;
  payment_status: string;
  total: number;
  shipping_method: string;
  tracking_number: string | null;
  created_at: string;
  items?: OnlineOrderItem[];
}

/**
 * Storefront settings from GET /api/v1/storefront/config. The route folds the
 * `storefront_config` key/value rows into one object, so the keys present
 * depend on what has been saved rather than on a fixed schema.
 */
export type StorefrontConfig = Record<string, string>;

/** A promo banner from GET /api/v1/storefront/banners (migration 053). */
export interface StorefrontBanner {
  id: number;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  position: number;
  is_active: number;
  created_at: string;
}

/**
 * A catalog row from GET /api/v1/storefront/products: the product itself plus
 * the three aggregates that route computes over reviews and sales.
 */
export interface StorefrontProduct extends Product {
  avg_rating: number;
  review_count: number;
  sold_count: number;
}
