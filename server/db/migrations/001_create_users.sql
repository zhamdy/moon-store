CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Cashier' CHECK (role IN ('Admin', 'Cashier', 'Delivery')),
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);
