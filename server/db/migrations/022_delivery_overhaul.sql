-- Migration 022: Delivery system overhaul
-- Update statuses: Pending → Order Received, Preparing → Shipping Contacted, Out for Delivery → In Transit
-- Add shipping_company and tracking_number columns

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Recreate delivery_orders with new CHECK constraint and new columns
CREATE TABLE IF NOT EXISTS delivery_orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'Order Received' CHECK(status IN ('Order Received', 'Shipping Contacted', 'In Transit', 'Delivered', 'Cancelled')),
  assigned_to INTEGER REFERENCES users(id),
  estimated_delivery TEXT,
  shipping_company TEXT,
  tracking_number TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Copy data with status mapping
INSERT INTO delivery_orders_new (id, order_number, customer_id, customer_name, phone, address, notes, status, assigned_to, estimated_delivery, shipping_company, tracking_number, created_at, updated_at)
SELECT id, order_number, customer_id, customer_name, phone, address, notes,
  CASE status
    WHEN 'Pending' THEN 'Order Received'
    WHEN 'Preparing' THEN 'Shipping Contacted'
    WHEN 'Out for Delivery' THEN 'In Transit'
    ELSE status
  END,
  assigned_to, estimated_delivery, NULL, NULL, created_at, updated_at
FROM delivery_orders;

-- Drop old table and rename new
DROP TABLE delivery_orders;
ALTER TABLE delivery_orders_new RENAME TO delivery_orders;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_assigned ON delivery_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_customer_id ON delivery_orders(customer_id);

-- Update status history to use new status names
UPDATE delivery_status_history SET status = 'Order Received' WHERE status = 'Pending';
UPDATE delivery_status_history SET status = 'Shipping Contacted' WHERE status = 'Preparing';
UPDATE delivery_status_history SET status = 'In Transit' WHERE status = 'Out for Delivery';

COMMIT;

PRAGMA foreign_keys = ON;
