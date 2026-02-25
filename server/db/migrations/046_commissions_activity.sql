-- Feature #44: Sales Commissions
ALTER TABLE users ADD COLUMN commission_rate REAL DEFAULT 0;

-- Feature #45: Activity Feed / Internal Notes
CREATE TABLE IF NOT EXISTS activity_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  pinned INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_activity_notes_user ON activity_notes(user_id);
