CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  previous_qty INTEGER NOT NULL,
  new_qty INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('Sale', 'Manual Adjustment', 'Refund Restock', 'Import', 'Damaged', 'Stock Count')),
  user_id INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adj_created ON stock_adjustments(created_at);
