-- Wave 3 Phase 2: E-commerce - Customer accounts
ALTER TABLE customers ADD COLUMN email TEXT;
ALTER TABLE customers ADD COLUMN password_hash TEXT;
ALTER TABLE customers ADD COLUMN is_registered INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN avatar_url TEXT;
ALTER TABLE customers ADD COLUMN date_of_birth TEXT;
ALTER TABLE customers ADD COLUMN gender TEXT;

-- Customer addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home',
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'SA',
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Customer wishlist
CREATE TABLE IF NOT EXISTS wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT (datetime('now')),
  UNIQUE(customer_id, product_id)
);
