-- Wave 3 Phase 4: Marketplace - Vendor Reviews & Analytics
CREATE TABLE IF NOT EXISTS vendor_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Vendor performance metrics (materialized)
CREATE TABLE IF NOT EXISTS vendor_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  period TEXT NOT NULL, -- e.g. '2026-02'
  total_orders INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_commission REAL DEFAULT 0,
  total_returns INTEGER DEFAULT 0,
  avg_rating REAL DEFAULT 0,
  UNIQUE(vendor_id, period)
);
