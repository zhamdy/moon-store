-- Delivery status history for timeline tracking
CREATE TABLE IF NOT EXISTS delivery_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES delivery_orders(id),
    status TEXT NOT NULL,
    notes TEXT,
    changed_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Add estimated delivery time to delivery orders
ALTER TABLE delivery_orders ADD COLUMN estimated_delivery TEXT;
