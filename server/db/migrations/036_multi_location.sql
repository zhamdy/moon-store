-- Feature #17: Multi-Location Inventory
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  type TEXT DEFAULT 'Store' CHECK (type IN ('Store', 'Warehouse')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Insert default location
INSERT INTO locations (name, type) VALUES ('Main Store', 'Store');

CREATE TABLE IF NOT EXISTS product_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  location_id INTEGER NOT NULL REFERENCES locations(id),
  stock INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, location_id)
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_location_id INTEGER NOT NULL REFERENCES locations(id),
  to_location_id INTEGER NOT NULL REFERENCES locations(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  notes TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT (datetime('now')),
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL
);

ALTER TABLE users ADD COLUMN location_id INTEGER REFERENCES locations(id);

-- Assign all existing users to the default Main Store
UPDATE users SET location_id = 1;

-- Create product_locations for all existing products in Main Store
INSERT INTO product_locations (product_id, location_id, stock)
SELECT id, 1, stock FROM products WHERE stock > 0;
