-- Wave 3 Phase 4: Marketplace - Commission & Payouts
CREATE TABLE IF NOT EXISTS vendor_commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  sale_id INTEGER REFERENCES sales(id),
  online_order_id INTEGER REFERENCES online_orders(id),
  order_total REAL NOT NULL,
  commission_rate REAL NOT NULL,
  commission_amount REAL NOT NULL,
  vendor_amount REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'cancelled')),
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  amount REAL NOT NULL,
  method TEXT DEFAULT 'bank_transfer',
  reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  period_from DATETIME,
  period_to DATETIME,
  notes TEXT,
  processed_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT (datetime('now')),
  completed_at DATETIME
);
