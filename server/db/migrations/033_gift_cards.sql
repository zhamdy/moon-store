-- Feature #8: Gift Card / Store Credit System
CREATE TABLE IF NOT EXISTS gift_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  initial_value REAL NOT NULL,
  balance REAL NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  expires_at DATETIME,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES gift_cards(id),
  sale_id INTEGER REFERENCES sales(id),
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('issue', 'redeem', 'refund', 'adjustment')),
  note TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_gc_transactions_card ON gift_card_transactions(card_id);
