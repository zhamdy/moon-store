-- Wave 3 Phase 3: Data Warehouse Views / Materialized Aggregations
-- Monthly sales aggregation
CREATE TABLE IF NOT EXISTS monthly_sales_agg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  location_id INTEGER REFERENCES locations(id),
  category TEXT,
  total_revenue REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  total_profit REAL DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  avg_order_value REAL DEFAULT 0,
  unique_customers INTEGER DEFAULT 0,
  UNIQUE(year, month, location_id, category)
);

-- Product performance metrics
CREATE TABLE IF NOT EXISTS product_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  period TEXT NOT NULL, -- e.g. '2026-02'
  units_sold INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  returns INTEGER DEFAULT 0,
  avg_selling_price REAL DEFAULT 0,
  stock_turnover REAL DEFAULT 0,
  UNIQUE(product_id, period)
);

-- Customer lifetime value
CREATE TABLE IF NOT EXISTS customer_ltv (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total_orders INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  avg_order_value REAL DEFAULT 0,
  first_purchase DATETIME,
  last_purchase DATETIME,
  predicted_ltv REAL DEFAULT 0,
  segment TEXT,
  updated_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(customer_id)
);
