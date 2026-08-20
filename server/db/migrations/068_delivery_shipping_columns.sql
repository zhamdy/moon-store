-- 021_shipping_companies.sql added shipping_company_id (a real FK) and
-- shipping_cost. 022_delivery_overhaul.sql then rebuilt delivery_orders from a
-- column list that omitted both, silently dropping them, while deliveryService
-- kept selecting and inserting them. Every list, performance and create request
-- has failed since.
ALTER TABLE delivery_orders ADD COLUMN shipping_company_id INTEGER REFERENCES shipping_companies(id);
ALTER TABLE delivery_orders ADD COLUMN shipping_cost REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_delivery_orders_shipping_company ON delivery_orders(shipping_company_id);
