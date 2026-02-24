-- Add product lifecycle status: active (sellable), inactive (hidden from POS), discontinued (archived)
ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'discontinued'));

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
