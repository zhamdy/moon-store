DROP INDEX IF EXISTS idx_delivery_orders_shipping_company;
ALTER TABLE delivery_orders DROP COLUMN shipping_cost;
ALTER TABLE delivery_orders DROP COLUMN shipping_company_id;
