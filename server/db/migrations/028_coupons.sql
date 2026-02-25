-- Feature #2: Coupon & Promo Code Engine
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value REAL NOT NULL,
  min_purchase REAL DEFAULT 0,
  max_discount REAL,
  starts_at DATETIME,
  expires_at DATETIME,
  max_uses INTEGER,
  max_uses_per_customer INTEGER,
  scope TEXT DEFAULT 'all' CHECK (scope IN ('all', 'category', 'product')),
  scope_ids TEXT DEFAULT '[]',
  stackable INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id),
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  customer_id INTEGER REFERENCES customers(id),
  discount_applied REAL NOT NULL,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_sale ON coupon_usage(sale_id);

ALTER TABLE sales ADD COLUMN coupon_id INTEGER REFERENCES coupons(id);
ALTER TABLE sales ADD COLUMN coupon_discount REAL DEFAULT 0;
