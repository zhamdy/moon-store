-- @FK_OFF
-- Create shipping companies table
CREATE TABLE IF NOT EXISTS shipping_companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Rebuild delivery_orders to update the CHECK constraint for new statuses
-- and add shipping fields
CREATE TABLE delivery_orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Preparing', 'Out for Delivery', 'Shipped', 'Delivered', 'Cancelled')),
  assigned_to INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  customer_id INTEGER REFERENCES customers(id),
  estimated_delivery TEXT,
  shipping_company_id INTEGER REFERENCES shipping_companies(id),
  tracking_number TEXT,
  shipping_cost REAL DEFAULT 0
);

INSERT INTO delivery_orders_new (id, order_number, customer_name, phone, address, notes, status, assigned_to, created_at, updated_at, customer_id, estimated_delivery)
  SELECT id, order_number, customer_name, phone, address, notes, status, assigned_to, created_at, updated_at, customer_id, estimated_delivery
  FROM delivery_orders;

DROP TABLE delivery_orders;
ALTER TABLE delivery_orders_new RENAME TO delivery_orders;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_assigned ON delivery_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_shipping_company ON delivery_orders(shipping_company_id);
