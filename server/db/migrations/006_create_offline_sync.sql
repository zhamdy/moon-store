CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
