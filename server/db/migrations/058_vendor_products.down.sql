-- Reverse 058_vendor_products
DROP TABLE IF EXISTS vendor_product_approvals;
-- Note: SQLite cannot drop columns added via ALTER TABLE (vendor_id, is_marketplace on products)
