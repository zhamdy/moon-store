-- Feature #26: Layaway / Pay Later
CREATE TABLE IF NOT EXISTS layaway_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  total REAL NOT NULL,
  deposit REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'overdue', 'expired')),
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_layaway_customer ON layaway_orders(customer_id);
CREATE INDEX idx_layaway_status ON layaway_orders(status);

CREATE TABLE IF NOT EXISTS layaway_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  layaway_id INTEGER NOT NULL REFERENCES layaway_orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS layaway_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  layaway_id INTEGER NOT NULL REFERENCES layaway_orders(id),
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_layaway_payments_layaway ON layaway_payments(layaway_id);
