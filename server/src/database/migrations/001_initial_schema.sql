-- 001_initial_schema.sql
-- Consolidated PostgreSQL Schema for MOON Fashion POS

-- ─── Users & Auth ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Cashier',
  commission_rate NUMERIC DEFAULT 0,
  favorites TEXT DEFAULT '[]',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Catalog (Categories & Distributors) ────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS distributors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  contact_info TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Products & Variants ───────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  price NUMERIC NOT NULL,
  cost_price NUMERIC DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  distributor_id INTEGER REFERENCES distributors(id) ON DELETE SET NULL,
  min_stock INTEGER DEFAULT 5,
  lead_time_days INTEGER DEFAULT 7,
  reorder_qty INTEGER DEFAULT 10,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  image_url TEXT,
  has_variants INTEGER DEFAULT 0,
  abc_classification TEXT DEFAULT 'C',
  abc_class TEXT DEFAULT 'C',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  price NUMERIC,
  cost_price NUMERIC DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  attributes TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value NUMERIC NOT NULL,
  new_value NUMERIC NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Customers & Loyalty ───────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  address TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  tier TEXT DEFAULT 'Bronze',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id INTEGER,
  points INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'earned', 'redeemed', 'adjusted'
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_segments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  criteria TEXT NOT NULL DEFAULT '{}',
  rules_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_segment_members (
  segment_id INTEGER NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (segment_id, customer_id)
);

CREATE TABLE IF NOT EXISTS customer_feedback (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  sale_id INTEGER,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  category TEXT DEFAULT 'general',
  comment TEXT,
  comments TEXT,
  source TEXT DEFAULT 'POS',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Settings & Global Config ──────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Sales & Payments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  receipt_number TEXT,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed',
  payment_method TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'completed',
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  points_redeemed INTEGER DEFAULT 0,
  notes TEXT,
  tip_amount NUMERIC DEFAULT 0,
  coupon_id INTEGER,
  coupon_discount NUMERIC DEFAULT 0,
  refund_status TEXT DEFAULT 'none',
  refunded_amount NUMERIC DEFAULT 0,
  receipt_sent_via TEXT,
  register_session_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL,
  price NUMERIC,
  cost_price NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  memo TEXT
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  items TEXT NOT NULL,
  restock INTEGER DEFAULT 1,
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Coupons & Gift Cards ──────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC NOT NULL,
  min_purchase NUMERIC,
  max_discount NUMERIC,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  max_uses_per_customer INTEGER,
  scope TEXT DEFAULT 'all' CHECK (scope IN ('all', 'category', 'product')),
  scope_ids TEXT,
  stackable INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  discount_applied NUMERIC NOT NULL,
  used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE,
  initial_value NUMERIC NOT NULL,
  balance NUMERIC NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'redeemed', 'expired')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id SERIAL PRIMARY KEY,
  gift_card_id INTEGER NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Inventory Management ──────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_qty INTEGER NOT NULL,
  new_qty INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id SERIAL PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_count_items (
  id SERIAL PRIMARY KEY,
  count_id INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  expected_qty INTEGER NOT NULL,
  counted_qty INTEGER,
  variance INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_reservations (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  source_type TEXT DEFAULT 'cart',
  source_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  total_products INTEGER NOT NULL,
  total_units INTEGER NOT NULL,
  total_cost_value NUMERIC NOT NULL,
  total_retail_value NUMERIC NOT NULL,
  snapshot_data TEXT DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Branches & Registers ──────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  phone TEXT,
  currency TEXT DEFAULT 'EGP',
  is_main INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branch_inventory (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (branch_id, product_id)
);

-- ─── Cash Register, Shifts & Expenses ──────────────────────
CREATE TABLE IF NOT EXISTS register_sessions (
  id SERIAL PRIMARY KEY,
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  opening_float NUMERIC NOT NULL DEFAULT 0,
  expected_cash NUMERIC NOT NULL DEFAULT 0,
  counted_cash NUMERIC,
  variance NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS register_movements (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES register_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'cash_in', 'cash_out')),
  amount NUMERIC NOT NULL,
  note TEXT,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  clock_out TIMESTAMPTZ,
  break_start TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  total_hours NUMERIC(5,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_break', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Layaway & Exchanges ───────────────────────────────────
CREATE TABLE IF NOT EXISTS layaway_plans (
  id SERIAL PRIMARY KEY,
  plan_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total_amount NUMERIC NOT NULL,
  deposit_amount NUMERIC NOT NULL,
  remaining_balance NUMERIC NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS layaway_items (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES layaway_plans(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS layaway_payments (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES layaway_plans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchanges (
  id SERIAL PRIMARY KEY,
  exchange_number TEXT,
  original_sale_id INTEGER NOT NULL REFERENCES sales(id),
  new_sale_id INTEGER REFERENCES sales(id),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  return_total NUMERIC DEFAULT 0,
  new_total NUMERIC DEFAULT 0,
  difference NUMERIC DEFAULT 0,
  price_difference NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_items (
  id SERIAL PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  returned_product_id INTEGER REFERENCES products(id),
  returned_quantity INTEGER NOT NULL,
  new_product_id INTEGER REFERENCES products(id),
  new_quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_returned_items (
  id SERIAL PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  condition TEXT DEFAULT 'good'
);

CREATE TABLE IF NOT EXISTS exchange_new_items (
  id SERIAL PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0
);

-- ─── Purchases & Vendors ───────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  distributor_id INTEGER REFERENCES distributors(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Ordered', 'Partial', 'Received', 'Cancelled', 'pending', 'received', 'cancelled')),
  total NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  expected_delivery TIMESTAMPTZ,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  cost_price NUMERIC NOT NULL,
  received_quantity INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  tax_number TEXT,
  commission_rate NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_products (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  consignment_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_commissions (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_reviews (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Fulfillment & Shipping ────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  contact_phone TEXT,
  tracking_url_template TEXT,
  is_active INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  items TEXT DEFAULT '[]',
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Shipped', 'Delivered', 'Cancelled')),
  estimated_delivery TIMESTAMPTZ,
  shipping_company_id INTEGER REFERENCES shipping_companies(id) ON DELETE SET NULL,
  tracking_number TEXT,
  shipping_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_tracking (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS online_orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  phone TEXT,
  email TEXT,
  shipping_address TEXT,
  address TEXT,
  city TEXT,
  subtotal NUMERIC DEFAULT 0,
  shipping_fee NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  items TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS online_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  unit_price NUMERIC
);

CREATE TABLE IF NOT EXISTS storefront_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storefront_banners (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  position INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Bundles, Collections & Templates ──────────────────────
CREATE TABLE IF NOT EXISTS product_bundles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC DEFAULT 0,
  bundle_price NUMERIC DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed',
  discount_value NUMERIC DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bundle_items (
  id SERIAL PRIMARY KEY,
  bundle_id INTEGER NOT NULL REFERENCES product_bundles(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS collections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  season TEXT,
  is_featured INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_products (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, product_id)
);

CREATE TABLE IF NOT EXISTS label_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  config TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Multi-location & Transfers ────────────────────────────

CREATE TABLE IF NOT EXISTS inter_store_transfers (
  id SERIAL PRIMARY KEY,
  from_branch_id INTEGER NOT NULL REFERENCES branches(id),
  to_branch_id INTEGER NOT NULL REFERENCES branches(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branch_transfers (
  id SERIAL PRIMARY KEY,
  source_branch_id INTEGER NOT NULL REFERENCES branches(id),
  target_branch_id INTEGER NOT NULL REFERENCES branches(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_performance (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  revenue NUMERIC DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Warranty & Feedback ───────────────────────────────────
CREATE TABLE IF NOT EXISTS warranties (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  duration_months INTEGER NOT NULL,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warranty_claims (
  id SERIAL PRIMARY KEY,
  warranty_id INTEGER REFERENCES warranties(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id),
  product_id INTEGER REFERENCES products(id),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  issue_description TEXT,
  resolution TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'resolved', 'replaced', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Audit, Notifications & Offline ────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id TEXT,
  link TEXT,
  read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Reports & AI ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_builder (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_reports (
  id SERIAL PRIMARY KEY,
  report_builder_id INTEGER REFERENCES report_builder(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_warehouse_sync (
  id SERIAL PRIMARY KEY,
  last_synced_at TIMESTAMPTZ,
  record_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle'
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  config TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ai_chat_sessions(session_id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_predictions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  predicted_quantity INTEGER NOT NULL,
  prediction_date DATE NOT NULL,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auto_descriptions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  generated_description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── Performance Indexes ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_cashier_id ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_register_sessions_cashier ON register_sessions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
