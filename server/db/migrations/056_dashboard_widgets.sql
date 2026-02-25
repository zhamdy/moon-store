-- Wave 3 Phase 3: Customizable Dashboard Widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  widget_type TEXT NOT NULL CHECK (widget_type IN ('kpi', 'chart', 'table', 'report')),
  title TEXT NOT NULL,
  config TEXT NOT NULL, -- JSON: data source, filters, dimensions
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 1,
  height INTEGER DEFAULT 1,
  is_visible INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now'))
);
