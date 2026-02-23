-- Link sales to customers
ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
