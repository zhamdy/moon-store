-- Add has_variants flag to products
ALTER TABLE products ADD COLUMN has_variants INTEGER DEFAULT 0;

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT UNIQUE,
    price REAL,
    cost_price REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    attributes TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Add variant_id to sale_items (optional, NULL for non-variant sales)
ALTER TABLE sale_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id);

-- Add variant_id to delivery_items (optional)
ALTER TABLE delivery_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);
