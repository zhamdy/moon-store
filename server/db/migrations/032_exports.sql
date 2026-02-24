-- Feature #23: Unified Export Center
CREATE TABLE IF NOT EXISTS exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  filters_json TEXT DEFAULT '{}',
  format TEXT NOT NULL CHECK (format IN ('csv', 'xlsx', 'pdf')),
  file_path TEXT,
  file_size INTEGER DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_exports_user ON exports(user_id);
