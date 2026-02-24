-- Feature #15: Full Stock Count Workflow
CREATE TABLE IF NOT EXISTS stock_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  category_id INTEGER REFERENCES categories(id),
  notes TEXT,
  started_by INTEGER REFERENCES users(id),
  started_at DATETIME DEFAULT (datetime('now')),
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS stock_count_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  count_id INTEGER NOT NULL REFERENCES stock_counts(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  expected_qty INTEGER NOT NULL,
  actual_qty INTEGER,
  approved INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_stock_count_items_count ON stock_count_items(count_id);
