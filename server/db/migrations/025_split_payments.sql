-- Feature #1: Split Payment Support
CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'Card', 'Other', 'Gift Card')),
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);

-- Feature #4: Digital Receipt tracking
ALTER TABLE sales ADD COLUMN receipt_sent_via TEXT;
