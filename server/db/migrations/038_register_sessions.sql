-- Feature #21: Cash Register / Drawer Management
CREATE TABLE IF NOT EXISTS register_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  opened_at DATETIME DEFAULT (datetime('now')),
  closed_at DATETIME,
  opening_float REAL NOT NULL DEFAULT 0,
  expected_cash REAL NOT NULL DEFAULT 0,
  counted_cash REAL,
  variance REAL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT
);
CREATE INDEX idx_register_sessions_cashier ON register_sessions(cashier_id);
CREATE INDEX idx_register_sessions_status ON register_sessions(status);

CREATE TABLE IF NOT EXISTS register_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES register_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'cash_in', 'cash_out')),
  amount REAL NOT NULL,
  sale_id INTEGER REFERENCES sales(id),
  note TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_register_movements_session ON register_movements(session_id);

-- Link sales to register sessions
ALTER TABLE sales ADD COLUMN register_session_id INTEGER REFERENCES register_sessions(id);
