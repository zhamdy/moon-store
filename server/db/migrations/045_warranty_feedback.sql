-- Feature #34: Warranty Claims
CREATE TABLE IF NOT EXISTS warranty_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  customer_id INTEGER REFERENCES customers(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  issue TEXT NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'in_progress', 'resolved', 'rejected')),
  resolution TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_warranty_sale ON warranty_claims(sale_id);

-- Feature #36: Customer Feedback / NPS
CREATE TABLE IF NOT EXISTS customer_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER REFERENCES sales(id),
  customer_id INTEGER REFERENCES customers(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  comment TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_feedback_sale ON customer_feedback(sale_id);
