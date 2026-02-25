-- Reverse 050_ecommerce_customers
DROP TABLE IF EXISTS wishlists;
DROP TABLE IF EXISTS customer_addresses;
-- Note: SQLite cannot drop columns added via ALTER TABLE (email, password_hash, is_registered, avatar_url, date_of_birth, gender on customers)
