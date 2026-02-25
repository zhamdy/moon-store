-- Wave 3 Phase 5: AI - Sales Predictions & Trends
CREATE TABLE IF NOT EXISTS sales_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER REFERENCES products(id),
  category TEXT,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('daily', 'weekly', 'monthly')),
  period TEXT NOT NULL, -- e.g. '2026-03' or '2026-W10'
  predicted_units INTEGER NOT NULL,
  predicted_revenue REAL NOT NULL,
  confidence REAL DEFAULT 0.5,
  actual_units INTEGER,
  actual_revenue REAL,
  model_version TEXT DEFAULT 'v1',
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(product_id, prediction_type, period)
);

CREATE TABLE IF NOT EXISTS trend_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'category', 'overall')),
  entity_id INTEGER,
  trend_type TEXT NOT NULL CHECK (trend_type IN ('growing', 'declining', 'stable', 'seasonal')),
  description TEXT,
  data TEXT, -- JSON: data points
  period_start TEXT,
  period_end TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
