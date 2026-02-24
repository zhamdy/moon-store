-- Feature #24: Expense Tracking & P&L
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('rent', 'salaries', 'utilities', 'marketing', 'supplies', 'other')),
  amount REAL NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT (date('now')),
  recurring TEXT DEFAULT 'one_time' CHECK (recurring IN ('one_time', 'daily', 'weekly', 'monthly', 'yearly')),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
