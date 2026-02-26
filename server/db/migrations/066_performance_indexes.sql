-- Critical: sale_items.product_id has NO index (used by every analytics query)
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sales_cashier_date ON sales(cashier_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_date ON sales(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_products_category_status ON products(category_id, status);
