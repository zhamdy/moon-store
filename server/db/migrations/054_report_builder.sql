-- Wave 3 Phase 3: Advanced Reporting / BI - Report Builder
CREATE TABLE IF NOT EXISTS saved_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('sales', 'inventory', 'customers', 'financial', 'custom')),
  config TEXT NOT NULL, -- JSON: fields, filters, groupBy, orderBy
  chart_type TEXT DEFAULT 'table' CHECK (chart_type IN ('table', 'bar', 'line', 'pie', 'area')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  is_public INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  last_run_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Scheduled reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
  schedule TEXT NOT NULL CHECK (schedule IN ('daily', 'weekly', 'monthly')),
  recipients TEXT NOT NULL, -- JSON array of emails
  is_active INTEGER DEFAULT 1,
  last_sent_at DATETIME,
  next_run_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now'))
);
