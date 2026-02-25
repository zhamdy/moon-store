-- Wave 3 Phase 5: AI - Smart Pricing
CREATE TABLE IF NOT EXISTS pricing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('demand_based', 'time_based', 'competitor', 'clearance', 'seasonal')),
  config TEXT NOT NULL, -- JSON: conditions, multiplier, min_price, max_price
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  applies_to TEXT DEFAULT 'all', -- 'all', 'category:X', 'product:X'
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  current_price REAL NOT NULL,
  suggested_price REAL NOT NULL,
  reason TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  rule_id INTEGER REFERENCES pricing_rules(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at DATETIME DEFAULT (datetime('now'))
);
