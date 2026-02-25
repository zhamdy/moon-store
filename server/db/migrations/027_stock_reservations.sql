-- Feature #12: Stock Reservation for Pending Orders
CREATE TABLE IF NOT EXISTS stock_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id),
  quantity INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('cart', 'delivery', 'held')),
  source_id TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_reservations_product ON stock_reservations(product_id);
CREATE INDEX idx_reservations_expires ON stock_reservations(expires_at);
