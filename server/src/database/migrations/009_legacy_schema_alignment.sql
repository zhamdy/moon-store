-- Repairs baseline edits that never ran on databases already stamped with 001.
-- The runner executes this whole migration in one transaction. Never seed or reset.
DO $repair_009$
DECLARE
  legacy_layaway boolean := to_regclass('layaway') IS NOT NULL;
BEGIN
  IF to_regclass('bundles') IS NOT NULL THEN
    IF to_regclass('product_bundles') IS NOT NULL THEN
      RAISE EXCEPTION '009: both bundles and product_bundles exist; reconcile records before upgrading';
    END IF;
    ALTER TABLE bundles RENAME TO product_bundles;
  END IF;
  IF to_regclass('layaway') IS NOT NULL THEN
    IF to_regclass('layaway_plans') IS NOT NULL THEN
      RAISE EXCEPTION '009: both layaway and layaway_plans exist; reconcile records before upgrading';
    END IF;
    ALTER TABLE layaway RENAME TO layaway_plans;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_plans' AND column_name = 'balance_remaining') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_plans' AND column_name = 'remaining_balance') THEN
      RAISE EXCEPTION '009: both layaway_plans.balance_remaining and remaining_balance exist; reconcile before upgrading';
    END IF;
    ALTER TABLE layaway_plans RENAME COLUMN balance_remaining TO remaining_balance;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_plans' AND column_name = 'expires_at') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_plans' AND column_name = 'due_date') THEN
      RAISE EXCEPTION '009: both layaway_plans.expires_at and due_date exist; reconcile before upgrading';
    END IF;
    ALTER TABLE layaway_plans RENAME COLUMN expires_at TO due_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_payments' AND column_name = 'layaway_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_payments' AND column_name = 'plan_id') THEN
      RAISE EXCEPTION '009: both layaway_payments.layaway_id and plan_id exist; reconcile before upgrading';
    END IF;
    ALTER TABLE layaway_payments RENAME COLUMN layaway_id TO plan_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_order_items' AND column_name = 'po_order_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_order_items' AND column_name = 'po_id') THEN
      RAISE EXCEPTION '009: both purchase_order_items.po_order_id and po_id exist; reconcile before upgrading';
    END IF;
    ALTER TABLE purchase_order_items RENAME COLUMN po_order_id TO po_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_order_items' AND column_name = 'unit_cost') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_order_items' AND column_name = 'cost_price') THEN
      RAISE EXCEPTION '009: both purchase_order_items.unit_cost and cost_price exist; reconcile before upgrading';
    END IF;
    ALTER TABLE purchase_order_items RENAME COLUMN unit_cost TO cost_price;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_count_items' AND column_name = 'stock_count_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_count_items' AND column_name = 'count_id') THEN
      RAISE EXCEPTION '009: both stock_count_items.stock_count_id and count_id exist; reconcile before upgrading';
    END IF;
    ALTER TABLE stock_count_items RENAME COLUMN stock_count_id TO count_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_count_items' AND column_name = 'difference') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_count_items' AND column_name = 'variance') THEN
      RAISE EXCEPTION '009: both stock_count_items.difference and variance exist; reconcile before upgrading';
    END IF;
    ALTER TABLE stock_count_items RENAME COLUMN difference TO variance;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_counts' AND column_name = 'counted_by') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_counts' AND column_name = 'created_by') THEN
      RAISE EXCEPTION '009: both stock_counts.counted_by and created_by exist; reconcile before upgrading';
    END IF;
    ALTER TABLE stock_counts RENAME COLUMN counted_by TO created_by;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shifts' AND column_name = 'start_time') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shifts' AND column_name = 'clock_in') THEN
      RAISE EXCEPTION '009: both shifts.start_time and clock_in exist; reconcile before upgrading';
    END IF;
    ALTER TABLE shifts RENAME COLUMN start_time TO clock_in;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shifts' AND column_name = 'end_time') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shifts' AND column_name = 'clock_out') THEN
      RAISE EXCEPTION '009: both shifts.end_time and clock_out exist; reconcile before upgrading';
    END IF;
    ALTER TABLE shifts RENAME COLUMN end_time TO clock_out;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'notifications' AND column_name = 'is_read') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'notifications' AND column_name = 'read') THEN
      RAISE EXCEPTION '009: both notifications.is_read and read exist; reconcile before upgrading';
    END IF;
    ALTER TABLE notifications RENAME COLUMN is_read TO read;
  END IF;
  CREATE TABLE IF NOT EXISTS branch_inventory (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, product_id)
  );
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'collections' AND column_name = 'image_url') THEN
    ALTER TABLE collections ADD COLUMN image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'collections' AND column_name = 'season') THEN
    ALTER TABLE collections ADD COLUMN season TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'collections' AND column_name = 'is_featured') THEN
    ALTER TABLE collections ADD COLUMN is_featured INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'collections' AND column_name = 'status') THEN
    ALTER TABLE collections ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'collections' AND column_name = 'updated_at') THEN
    ALTER TABLE collections ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'coupons' AND column_name = 'updated_at') THEN
    ALTER TABLE coupons ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'customer_feedback' AND column_name = 'category') THEN
    ALTER TABLE customer_feedback ADD COLUMN category TEXT DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'customer_feedback' AND column_name = 'comment') THEN
    ALTER TABLE customer_feedback ADD COLUMN comment TEXT;
    UPDATE customer_feedback SET comment = comments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'customer_feedback' AND column_name = 'updated_at') THEN
    ALTER TABLE customer_feedback ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'customer_segments' AND column_name = 'rules_json') THEN
    ALTER TABLE customer_segments ADD COLUMN rules_json TEXT;
    UPDATE customer_segments SET rules_json = criteria;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'customer_segments' AND column_name = 'updated_at') THEN
    ALTER TABLE customer_segments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'distributors' AND column_name = 'contact_info') THEN
    ALTER TABLE distributors ADD COLUMN contact_info TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exchanges' AND column_name = 'exchange_number') THEN
    ALTER TABLE exchanges ADD COLUMN exchange_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exchanges' AND column_name = 'customer_id') THEN
    ALTER TABLE exchanges ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exchanges' AND column_name = 'return_total') THEN
    ALTER TABLE exchanges ADD COLUMN return_total NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exchanges' AND column_name = 'new_total') THEN
    ALTER TABLE exchanges ADD COLUMN new_total NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exchanges' AND column_name = 'difference') THEN
    ALTER TABLE exchanges ADD COLUMN difference NUMERIC DEFAULT 0;
    UPDATE exchanges SET difference = price_difference;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exchanges' AND column_name = 'payment_method') THEN
    ALTER TABLE exchanges ADD COLUMN payment_method TEXT DEFAULT 'Cash';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exchanges' AND column_name = 'notes') THEN
    ALTER TABLE exchanges ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exchanges' AND column_name = 'updated_at') THEN
    ALTER TABLE exchanges ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'inventory_snapshots' AND column_name = 'snapshot_data') THEN
    ALTER TABLE inventory_snapshots ADD COLUMN snapshot_data TEXT DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'inventory_snapshots' AND column_name = 'updated_at') THEN
    ALTER TABLE inventory_snapshots ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_payments' AND column_name = 'notes') THEN
    ALTER TABLE layaway_payments ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_plans' AND column_name = 'plan_number') THEN
    ALTER TABLE layaway_plans ADD COLUMN plan_number TEXT;
    UPDATE layaway_plans SET plan_number = 'LEGACY-' || id::text;
    ALTER TABLE layaway_plans ADD CONSTRAINT layaway_plans_plan_number_key UNIQUE (plan_number);
    ALTER TABLE layaway_plans ALTER COLUMN plan_number SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_plans' AND column_name = 'notes') THEN
    ALTER TABLE layaway_plans ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'layaway_plans' AND column_name = 'created_by') THEN
    ALTER TABLE layaway_plans ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'notifications' AND column_name = 'user_id') THEN
    ALTER TABLE notifications ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'notifications' AND column_name = 'entity_type') THEN
    ALTER TABLE notifications ADD COLUMN entity_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'notifications' AND column_name = 'entity_id') THEN
    ALTER TABLE notifications ADD COLUMN entity_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'notifications' AND column_name = 'link') THEN
    ALTER TABLE notifications ADD COLUMN link TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_order_items' AND column_name = 'variant_id') THEN
    ALTER TABLE online_order_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_order_items' AND column_name = 'price') THEN
    ALTER TABLE online_order_items ADD COLUMN price NUMERIC;
    UPDATE online_order_items SET price = unit_price;
    ALTER TABLE online_order_items ALTER COLUMN price SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_orders' AND column_name = 'customer_id') THEN
    ALTER TABLE online_orders ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_orders' AND column_name = 'customer_phone') THEN
    ALTER TABLE online_orders ADD COLUMN customer_phone TEXT;
    UPDATE online_orders SET customer_phone = phone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_orders' AND column_name = 'customer_email') THEN
    ALTER TABLE online_orders ADD COLUMN customer_email TEXT;
    UPDATE online_orders SET customer_email = email;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_orders' AND column_name = 'shipping_address') THEN
    ALTER TABLE online_orders ADD COLUMN shipping_address TEXT;
    UPDATE online_orders SET shipping_address = address;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_orders' AND column_name = 'city') THEN
    ALTER TABLE online_orders ADD COLUMN city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_orders' AND column_name = 'subtotal') THEN
    ALTER TABLE online_orders ADD COLUMN subtotal NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_orders' AND column_name = 'shipping_fee') THEN
    ALTER TABLE online_orders ADD COLUMN shipping_fee NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'online_orders' AND column_name = 'notes') THEN
    ALTER TABLE online_orders ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product_bundles' AND column_name = 'description') THEN
    ALTER TABLE product_bundles ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product_bundles' AND column_name = 'bundle_price') THEN
    ALTER TABLE product_bundles ADD COLUMN bundle_price NUMERIC DEFAULT 0;
    UPDATE product_bundles SET bundle_price = price;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product_bundles' AND column_name = 'discount_type') THEN
    ALTER TABLE product_bundles ADD COLUMN discount_type TEXT DEFAULT 'fixed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product_bundles' AND column_name = 'discount_value') THEN
    ALTER TABLE product_bundles ADD COLUMN discount_value NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product_bundles' AND column_name = 'starts_at') THEN
    ALTER TABLE product_bundles ADD COLUMN starts_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product_bundles' AND column_name = 'expires_at') THEN
    ALTER TABLE product_bundles ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'lead_time_days') THEN
    ALTER TABLE products ADD COLUMN lead_time_days INTEGER DEFAULT 7;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'reorder_qty') THEN
    ALTER TABLE products ADD COLUMN reorder_qty INTEGER DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'abc_class') THEN
    ALTER TABLE products ADD COLUMN abc_class TEXT DEFAULT 'C';
    UPDATE products SET abc_class = abc_classification;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_order_items' AND column_name = 'variant_id') THEN
    ALTER TABLE purchase_order_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_orders' AND column_name = 'total') THEN
    ALTER TABLE purchase_orders ADD COLUMN total NUMERIC DEFAULT 0;
    UPDATE purchase_orders SET total = total_cost;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_orders' AND column_name = 'total_amount') THEN
    ALTER TABLE purchase_orders ADD COLUMN total_amount NUMERIC DEFAULT 0;
    UPDATE purchase_orders SET total_amount = total_cost;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'purchase_orders' AND column_name = 'expected_delivery') THEN
    ALTER TABLE purchase_orders ADD COLUMN expected_delivery TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sale_items' AND column_name = 'price') THEN
    ALTER TABLE sale_items ADD COLUMN price NUMERIC;
    UPDATE sale_items SET price = unit_price;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sale_items' AND column_name = 'discount') THEN
    ALTER TABLE sale_items ADD COLUMN discount NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sale_items' AND column_name = 'subtotal') THEN
    ALTER TABLE sale_items ADD COLUMN subtotal NUMERIC DEFAULT 0;
    UPDATE sale_items SET subtotal = quantity * unit_price;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sales' AND column_name = 'receipt_number') THEN
    ALTER TABLE sales ADD COLUMN receipt_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sales' AND column_name = 'subtotal') THEN
    ALTER TABLE sales ADD COLUMN subtotal NUMERIC DEFAULT 0;
    UPDATE sales s SET subtotal = COALESCE(
      (SELECT SUM(i.quantity * i.unit_price) FROM sale_items i WHERE i.sale_id = s.id),
      s.total + COALESCE(s.discount, 0) - COALESCE(s.tax_amount, 0)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sales' AND column_name = 'tax') THEN
    ALTER TABLE sales ADD COLUMN tax NUMERIC DEFAULT 0;
    UPDATE sales SET tax = tax_amount;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sales' AND column_name = 'status') THEN
    ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'sales' AND column_name = 'updated_at') THEN
    ALTER TABLE sales ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shifts' AND column_name = 'branch_id') THEN
    ALTER TABLE shifts ADD COLUMN branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shifts' AND column_name = 'break_start') THEN
    ALTER TABLE shifts ADD COLUMN break_start TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shifts' AND column_name = 'total_hours') THEN
    ALTER TABLE shifts ADD COLUMN total_hours NUMERIC(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shipping_companies' AND column_name = 'phone') THEN
    ALTER TABLE shipping_companies ADD COLUMN phone TEXT;
    UPDATE shipping_companies SET phone = contact_phone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shipping_companies' AND column_name = 'email') THEN
    ALTER TABLE shipping_companies ADD COLUMN email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shipping_companies' AND column_name = 'is_active') THEN
    ALTER TABLE shipping_companies ADD COLUMN is_active INTEGER DEFAULT 1;
    UPDATE shipping_companies SET is_active = active;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'shipping_companies' AND column_name = 'updated_at') THEN
    ALTER TABLE shipping_companies ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_count_items' AND column_name = 'variant_id') THEN
    ALTER TABLE stock_count_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_count_items' AND column_name = 'notes') THEN
    ALTER TABLE stock_count_items ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_reservations' AND column_name = 'variant_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_reservations' AND column_name = 'source_type') THEN
    ALTER TABLE stock_reservations ADD COLUMN source_type TEXT DEFAULT 'cart';
    UPDATE stock_reservations SET source_type = reference_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_reservations' AND column_name = 'source_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN source_id TEXT;
    UPDATE stock_reservations SET source_id = reference_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'stock_reservations' AND column_name = 'updated_at') THEN
    ALTER TABLE stock_reservations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'favorites') THEN
    ALTER TABLE users ADD COLUMN favorites TEXT DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'vendors' AND column_name = 'tax_number') THEN
    ALTER TABLE vendors ADD COLUMN tax_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'vendors' AND column_name = 'updated_at') THEN
    ALTER TABLE vendors ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'warranty_claims' AND column_name = 'product_id') THEN
    ALTER TABLE warranty_claims ADD COLUMN product_id INTEGER REFERENCES products(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'warranty_claims' AND column_name = 'customer_name') THEN
    ALTER TABLE warranty_claims ADD COLUMN customer_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'warranty_claims' AND column_name = 'customer_phone') THEN
    ALTER TABLE warranty_claims ADD COLUMN customer_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'warranty_claims' AND column_name = 'issue_description') THEN
    ALTER TABLE warranty_claims ADD COLUMN issue_description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'warranty_claims' AND column_name = 'resolution') THEN
    ALTER TABLE warranty_claims ADD COLUMN resolution TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'warranty_claims' AND column_name = 'resolved_at') THEN
    ALTER TABLE warranty_claims ADD COLUMN resolved_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'warranty_claims' AND column_name = 'updated_at') THEN
    ALTER TABLE warranty_claims ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'product_bundles' AND column_name = 'sku') THEN
    ALTER TABLE product_bundles ALTER COLUMN sku DROP NOT NULL;
  END IF;
  IF legacy_layaway THEN
    ALTER TABLE layaway_plans ALTER COLUMN items DROP NOT NULL;
  END IF;
  ALTER TABLE inventory_snapshots ALTER COLUMN snapshot_date DROP NOT NULL;
  ALTER TABLE inventory_snapshots ALTER COLUMN snapshot_date SET DEFAULT CURRENT_DATE;
  ALTER TABLE notifications ALTER COLUMN message DROP NOT NULL;
  ALTER TABLE online_order_items ALTER COLUMN unit_price DROP NOT NULL;
  ALTER TABLE online_orders ALTER COLUMN phone DROP NOT NULL;
  ALTER TABLE online_orders ALTER COLUMN address DROP NOT NULL;
  ALTER TABLE online_orders ALTER COLUMN status SET DEFAULT 'pending'::text;
  ALTER TABLE online_orders ALTER COLUMN items DROP NOT NULL;
  ALTER TABLE purchase_orders ALTER COLUMN status SET DEFAULT 'Draft'::text;
  ALTER TABLE stock_counts ALTER COLUMN name DROP NOT NULL;
  ALTER TABLE stock_counts ALTER COLUMN status SET DEFAULT 'in_progress'::text;
  ALTER TABLE stock_reservations ALTER COLUMN reference_type DROP NOT NULL;
  ALTER TABLE stock_reservations ALTER COLUMN reference_id DROP NOT NULL;
  ALTER TABLE warranty_claims ALTER COLUMN warranty_id DROP NOT NULL;
  ALTER TABLE warranty_claims ALTER COLUMN sale_id DROP NOT NULL;
  ALTER TABLE shifts ALTER COLUMN clock_in SET DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE stock_count_items ALTER COLUMN variance SET DEFAULT 0;
  ALTER TABLE product_bundles ALTER COLUMN price SET DEFAULT 0;
  ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_status_check;
  ALTER TABLE shifts ADD CONSTRAINT shifts_status_check CHECK (status IN ('active', 'on_break', 'completed')) NOT VALID;
  ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
  ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check CHECK (status IN ('Draft', 'Ordered', 'Partial', 'Received', 'Cancelled', 'pending', 'received', 'cancelled')) NOT VALID;
  ALTER TABLE warranty_claims DROP CONSTRAINT IF EXISTS warranty_claims_status_check;
  ALTER TABLE warranty_claims ADD CONSTRAINT warranty_claims_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'resolved', 'replaced', 'refunded')) NOT VALID;
  -- Preserve serialized legacy items; malformed or ambiguous payloads abort atomically.
  IF legacy_layaway THEN
    IF EXISTS (SELECT 1 FROM layaway_plans WHERE items IS NOT NULL AND jsonb_typeof(items::jsonb) <> 'array') THEN
      RAISE EXCEPTION '009: layaway.items must contain JSON arrays';
    END IF;
    IF EXISTS (SELECT 1 FROM layaway_items) AND EXISTS (SELECT 1 FROM layaway_plans WHERE items IS NOT NULL AND items::jsonb <> '[]'::jsonb) THEN
      RAISE EXCEPTION '009: both serialized and normalized layaway items exist; reconcile before upgrading';
    END IF;
    IF EXISTS (
      SELECT 1 FROM layaway_plans p CROSS JOIN LATERAL jsonb_array_elements(p.items::jsonb) item
      WHERE (item->>'quantity')::integer <= 0
         OR COALESCE(item->>'unit_price', item->>'price')::numeric < 0
         OR (item ? 'unit_price' AND item ? 'price' AND
             (item->>'unit_price')::numeric <> (item->>'price')::numeric)
    ) THEN
      RAISE EXCEPTION '009: invalid quantity or ambiguous price in legacy layaway items';
    END IF;
    INSERT INTO layaway_items (plan_id, product_id, variant_id, quantity, price)
    SELECT p.id, (item->>'product_id')::integer, (item->>'variant_id')::integer,
           (item->>'quantity')::integer, COALESCE(item->>'unit_price', item->>'price')::numeric
    FROM layaway_plans p CROSS JOIN LATERAL jsonb_array_elements(p.items::jsonb) item;
  END IF;
END
$repair_009$;
