-- Wave 3 Phase 1: Enhanced inter-store transfers
-- Add more transfer tracking fields
ALTER TABLE stock_transfers ADD COLUMN expected_date TEXT;
ALTER TABLE stock_transfers ADD COLUMN reference_number TEXT;
ALTER TABLE stock_transfers ADD COLUMN approved_by INTEGER REFERENCES users(id);

-- Transfer request workflow
CREATE TABLE IF NOT EXISTS transfer_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_location_id INTEGER NOT NULL REFERENCES locations(id),
  to_location_id INTEGER NOT NULL REFERENCES locations(id),
  requested_by INTEGER NOT NULL REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transfer_request_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL
);
