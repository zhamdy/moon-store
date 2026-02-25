-- Wave 3 Phase 2: E-commerce - Online orders
CREATE TABLE IF NOT EXISTS online_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL DEFAULT 0,
  shipping_cost REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'card',
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_intent_id TEXT,
  shipping_address_id INTEGER REFERENCES customer_addresses(id),
  shipping_method TEXT DEFAULT 'standard',
  tracking_number TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS online_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

-- Shopping cart (server-side for logged-in customers)
CREATE TABLE IF NOT EXISTS shopping_carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(customer_id, product_id, variant_id)
);
