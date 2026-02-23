CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  amount REAL NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('Customer Return', 'Cashier Error', 'Defective', 'Other')),
  items TEXT NOT NULL, -- JSON array of {product_id, quantity, unit_price}
  restock INTEGER NOT NULL DEFAULT 1, -- boolean: 1 = restock items, 0 = no restock
  cashier_id INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Track refund status on sales
ALTER TABLE sales ADD COLUMN refund_status TEXT DEFAULT NULL CHECK (refund_status IN ('partial', 'full'));
ALTER TABLE sales ADD COLUMN refunded_amount REAL DEFAULT 0;
