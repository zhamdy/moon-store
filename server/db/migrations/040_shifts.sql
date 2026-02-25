-- Feature #23: Employee Shift & Time Tracking
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  clock_in DATETIME NOT NULL DEFAULT (datetime('now')),
  clock_out DATETIME,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_break', 'completed')),
  total_hours REAL,
  break_minutes INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX idx_shifts_user ON shifts(user_id);
CREATE INDEX idx_shifts_status ON shifts(status);

CREATE TABLE IF NOT EXISTS shift_breaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts(id),
  start_time DATETIME NOT NULL DEFAULT (datetime('now')),
  end_time DATETIME,
  duration_minutes INTEGER
);
CREATE INDEX idx_shift_breaks_shift ON shift_breaks(shift_id);
