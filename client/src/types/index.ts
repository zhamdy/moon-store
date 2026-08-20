// Shared types used across multiple pages

/** Standard API error response shape */
export interface ApiErrorResponse {
  error?: string;
}

/** Product from GET /api/products (full shape) */
export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  category: string | null;
  category_id: number | null;
  category_name: string | null;
  category_code: string | null;
  distributor_id: number | null;
  distributor_name: string | null;
  image_url: string | null;
  has_variants: number;
  variant_count: number;
  variant_stock: number;
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string;
  updated_at: string;
}

/** Product variant from GET /api/products/:id/variants */
export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  barcode: string | null;
  price: number | null;
  cost_price: number;
  stock: number;
  attributes: Record<string, string>;
}

/** Write payload for POST /api/products and PUT /api/products/:id */
export interface ProductFormData {
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost_price: number;
  stock: number;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
}

/** Category summary from GET /api/products/categories (id/name/code projection) */
export interface Category {
  id: number;
  name: string;
  code: string;
}

/**
 * Category row from GET /api/categories — the collection's own full shape.
 * Deliberately separate from `Category`, which is the trimmed projection the
 * product routes hand out.
 */
export interface CategoryRecord {
  id: number;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

/** Distributor from GET /api/distributors */
export interface Distributor {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Customer from GET /api/customers */
export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'Admin' | 'Cashier' | 'Delivery';

/** User from GET /api/users */
export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  last_login: string | null;
  created_at: string;
}

/** Auth responses project only the identity columns, not the audit ones */
export type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

/** Body of POST /api/auth/login and POST /api/auth/refresh */
export interface AuthResponseData {
  data: {
    accessToken: string;
    user: AuthUser;
  };
}

/** Sale line item from GET /api/sales/:id (read shape, not the write payload) */
export interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

/**
 * Settings map from GET /api/settings. The route builds it from whatever rows
 * exist, so every key is optional.
 */
export interface AppSettings {
  tax_enabled?: 'true' | 'false';
  tax_rate?: string;
  tax_mode?: 'inclusive' | 'exclusive';
  loyalty_enabled?: 'true' | 'false';
  loyalty_earn_rate?: string;
  loyalty_redeem_value?: string;
}

/** One RFM segment's roll-up from GET /api/segments */
export interface SegmentSummary {
  segment: string;
  count: number;
  total_revenue: number;
  avg_frequency: number;
}

/** A customer scored on recency/frequency/monetary, from GET /api/segments */
export interface CustomerRFM {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  recency_days: number;
  frequency: number;
  monetary: number;
  segment: string;
  loyalty_points: number;
}

/** Body of GET /api/segments */
export interface SegmentsResponse {
  customers: CustomerRFM[];
  summary: SegmentSummary[];
}

/** One survey response from GET /api/feedback */
export interface FeedbackEntry {
  id: number;
  sale_id: number | null;
  customer_name: string | null;
  rating: number | null;
  nps_score: number | null;
  comment: string | null;
  created_at: string;
}

/** Aggregate satisfaction figures returned beside the feedback list */
export interface FeedbackStats {
  avg_rating: number | null;
  total_responses: number;
  nps_score: number | null;
}

/** Body of GET /api/feedback */
export interface FeedbackResponse {
  feedback: FeedbackEntry[];
  stats: FeedbackStats;
}

/** Collection row from GET /api/collections */
export interface Collection {
  id: number;
  name: string;
  season: string | null;
  year: number | null;
  status: string;
  description: string | null;
  product_count: number;
}

/**
 * A product as the collection detail endpoint projects it — fewer columns than
 * `Product`, since a collection only shows what it takes to identify a line.
 */
export interface CollectionProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  image_url: string | null;
}

/** GET /api/collections/:id — the list row plus the products it holds */
export interface CollectionDetail extends Collection {
  products: CollectionProduct[];
}

/** One product line inside a bundle */
export interface BundleItem {
  id?: number;
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
}

/** Bundle from GET /api/bundles, and from GET /api/bundles/:id */
export interface Bundle {
  id: number;
  name: string;
  description: string | null;
  price: number;
  status: string;
  items: BundleItem[];
  original_price: number;
  savings: number;
  savings_percent: number;
  created_at: string;
}

/** Coupon from GET /api/coupons */
export interface Coupon {
  id: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase: number | null;
  max_discount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  scope: 'all' | 'category' | 'product';
  scope_ids: number[] | null;
  stackable: number;
  status: string;
  usage_count: number;
  created_at: string;
}

/** Warranty claim from GET /api/warranty */
export interface WarrantyClaim {
  id: number;
  sale_id: number;
  product_name: string;
  customer_name: string | null;
  issue: string;
  status: string;
  resolution: string | null;
  created_at: string;
}

/** Gift card from GET /api/gift-cards */
export interface GiftCard {
  id: number;
  code: string;
  barcode: string | null;
  initial_value: number;
  balance: number;
  status: 'active' | 'used' | 'cancelled';
  customer_id: number | null;
  customer_name: string | null;
  expires_at: string | null;
  created_at: string;
}

/** One ledger entry from GET /api/gift-cards/:id/transactions */
export interface GiftCardTransaction {
  id: number;
  gift_card_id: number;
  type: string;
  amount: number;
  reference_id: number | null;
  created_at: string;
}
