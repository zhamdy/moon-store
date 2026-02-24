-- Feature #13: Price History & Margin Tracking
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  field TEXT NOT NULL CHECK (field IN ('price', 'cost_price')),
  old_value REAL NOT NULL,
  new_value REAL NOT NULL,
  user_id INTEGER REFERENCES users(id),
  reason TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_price_history_product ON price_history(product_id);
