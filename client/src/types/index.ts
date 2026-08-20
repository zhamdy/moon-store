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

/**
 * A row from GET products/low-stock: a product plus how far under its floor it
 * sits. The server computes the deficit, so the client never has to guess which
 * of two subtractions it meant.
 */
export interface LowStockProduct extends Product {
  deficit: number;
}

/** One parsed line of the CSV the inventory page imports. */
export interface CsvProduct {
  name: string;
  sku: string;
  barcode: string;
  price: number;
  cost_price: number;
  stock: number;
  category: string;
  min_stock: number;
}

/** What POST products/import reports back, per file. */
export interface ProductImportResult {
  imported: number;
  errors: Array<{ row: number; error: string }>;
}

/** What POST products/bulk-delete reports back. */
export interface BulkDiscontinueResult {
  deleted: number;
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

/** Register session from GET /api/v1/register/current and /history */
export interface RegisterSession {
  id: number;
  cashier_id: number;
  cashier_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  expected_cash: number;
  counted_cash: number | null;
  variance: number | null;
  status: 'open' | 'closed';
  notes: string | null;
  sale_count?: number;
  total_in?: number;
  total_out?: number;
  total_sales?: number;
}

/** One cash movement inside a register session */
export interface RegisterMovement {
  id: number;
  session_id: number;
  type: 'sale' | 'refund' | 'cash_in' | 'cash_out';
  amount: number;
  sale_id: number | null;
  note: string | null;
  created_at: string;
}

/** GET /api/v1/register/:id/report */
export interface RegisterReportData {
  session: RegisterSession;
  movements: RegisterMovement[];
  summary: {
    total_sales: number;
    total_refunds: number;
    total_cash_in: number;
    total_cash_out: number;
    sale_count: number;
    refund_count: number;
  };
}

/** Shift from GET /api/v1/shifts/current, /active and /history */
export interface Shift {
  id: number;
  user_id: number;
  user_name: string;
  role?: string;
  clock_in: string;
  clock_out: string | null;
  status: 'active' | 'on_break' | 'completed';
  total_hours: number | null;
  break_minutes: number;
}

/** One person's totals from GET /api/v1/shifts/timesheet */
export interface TimesheetEntry {
  id: number;
  name: string;
  role: string;
  shift_count: number;
  total_hours: number;
  total_break_minutes: number;
}

/** A sale row from GET /api/v1/sales. */
export interface Sale {
  id: number;
  total: number;
  discount: number | null;
  discount_type: 'fixed' | 'percentage' | null;
  payment_method: string;
  cashier_id: number;
  cashier_name: string;
  items_count: number;
  created_at: string;
  refund_status: 'partial' | 'full' | null;
  refunded_amount: number | null;
  customer_id: number | null;
  customer_name: string | null;
}

/** The aggregate figures GET /api/v1/sales returns beside the rows. */
export interface SalesMeta {
  total: number;
  total_revenue: number;
  page: number;
  limit: number;
}

/** GET /api/v1/sales/:id — the same sale, with its lines attached. */
export interface SaleDetail {
  id: number;
  total: number;
  discount: number | null;
  discount_type: string | null;
  payment_method: string;
  cashier_name: string | null;
  created_at: string;
  items: SaleItem[];
}

/** One refund against a sale, from GET /api/v1/sales/:id/refunds. */
export interface SaleRefund {
  id: number;
  amount: number;
  reason: string;
  cashier_name: string | null;
  created_at: string;
  items: SaleItem[];
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

/** A pending price change from GET /api/v1/ai/pricing/suggestions. */
export interface PriceSuggestion {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  current_price: number;
  suggested_price: number;
  reason: string;
  confidence: number;
  status: string;
}

/** A standing rule from GET /api/v1/ai/pricing/rules. */
export interface PricingRule {
  id: number;
  name: string;
  rule_type: string;
  config: string;
  priority: number;
  is_active: number;
  applies_to: string;
}

/** A stock count row from GET /api/v1/stock-counts, with its progress totals. */
export interface StockCountSummary {
  id: number;
  status: string;
  category_name: string | null;
  notes: string | null;
  started_by_name: string;
  started_at: string;
  item_count: number;
  counted: number;
}

/** One product being counted, from GET /api/v1/stock-counts/:id. */
export interface StockCountItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  expected_qty: number;
  actual_qty: number | null;
  approved: number;
}

/** GET /api/v1/stock-counts/:id — the count with every item it covers. */
export interface StockCountDetail extends StockCountSummary {
  items: StockCountItem[];
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
