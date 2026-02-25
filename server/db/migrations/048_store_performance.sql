-- Wave 3 Phase 1: Store performance tracking & consolidated views
-- Add location_id to sales for per-store tracking
ALTER TABLE sales ADD COLUMN location_id INTEGER;
UPDATE sales SET location_id = 1 WHERE location_id IS NULL;

-- Store daily summaries (materialized for dashboard performance)
CREATE TABLE IF NOT EXISTS store_daily_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL REFERENCES locations(id),
  summary_date TEXT NOT NULL,
  total_sales INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0,
  total_refunds REAL DEFAULT 0,
  total_customers INTEGER DEFAULT 0,
  avg_order_value REAL DEFAULT 0,
  top_category TEXT,
  UNIQUE(location_id, summary_date)
);
