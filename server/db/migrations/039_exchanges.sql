-- Feature #22: Exchange Workflow
CREATE TABLE IF NOT EXISTS exchanges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_sale_id INTEGER NOT NULL REFERENCES sales(id),
  new_sale_id INTEGER REFERENCES sales(id),
  return_total REAL NOT NULL DEFAULT 0,
  new_total REAL NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  balance_type TEXT CHECK (balance_type IN ('customer_pays', 'store_refunds', 'even')),
  payment_method TEXT,
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  customer_id INTEGER REFERENCES customers(id),
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_exchanges_original_sale ON exchanges(original_sale_id);
CREATE INDEX idx_exchanges_new_sale ON exchanges(new_sale_id);

CREATE TABLE IF NOT EXISTS exchange_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_new_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exchange_id INTEGER NOT NULL REFERENCES exchanges(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL
);
