-- Wave 3 Phase 1: Enhanced Multi-Store / Branch Management
-- Enhance locations table with branch management fields
ALTER TABLE locations ADD COLUMN phone TEXT;
ALTER TABLE locations ADD COLUMN email TEXT;
ALTER TABLE locations ADD COLUMN manager_id INTEGER REFERENCES users(id);
ALTER TABLE locations ADD COLUMN opening_hours TEXT; -- JSON string
ALTER TABLE locations ADD COLUMN currency TEXT DEFAULT 'SAR';
ALTER TABLE locations ADD COLUMN tax_rate REAL DEFAULT 15.0;
ALTER TABLE locations ADD COLUMN is_primary INTEGER DEFAULT 0;

-- Update Main Store as primary
UPDATE locations SET is_primary = 1 WHERE id = 1;

-- Store-specific POS settings
CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  UNIQUE(location_id, setting_key)
);

-- Insert default POS settings for Main Store
INSERT OR IGNORE INTO store_settings (location_id, setting_key, setting_value) VALUES
  (1, 'receipt_header', 'MOON Fashion & Style'),
  (1, 'receipt_footer', 'Thank you for shopping with us!'),
  (1, 'default_payment_method', 'cash'),
  (1, 'allow_negative_stock', 'false'),
  (1, 'auto_print_receipt', 'true');
