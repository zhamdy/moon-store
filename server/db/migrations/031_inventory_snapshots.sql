-- Feature #16: Inventory Snapshots & Valuation Reports
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  stock INTEGER NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,
  value REAL NOT NULL DEFAULT 0,
  category_id INTEGER,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_snapshots_date ON inventory_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_product ON inventory_snapshots(product_id);
