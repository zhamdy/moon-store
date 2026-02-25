-- Wave 3 Phase 4: Marketplace - Vendor Products
ALTER TABLE products ADD COLUMN vendor_id INTEGER;
ALTER TABLE products ADD COLUMN is_marketplace INTEGER DEFAULT 0;

-- Vendor-specific product approvals
CREATE TABLE IF NOT EXISTS vendor_product_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  reviewed_at DATETIME
);
