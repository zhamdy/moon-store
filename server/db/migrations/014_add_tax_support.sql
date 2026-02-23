-- Add tax_amount to sales
ALTER TABLE sales ADD COLUMN tax_amount REAL DEFAULT 0;

-- Create settings table for app configuration
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default tax settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_enabled', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_rate', '15');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_mode', 'exclusive');
