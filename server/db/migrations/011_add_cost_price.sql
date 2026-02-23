-- Add cost price to products
ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;

-- Snapshot cost price into sale items
ALTER TABLE sale_items ADD COLUMN cost_price REAL DEFAULT 0;
