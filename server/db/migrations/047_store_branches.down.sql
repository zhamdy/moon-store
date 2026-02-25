-- Reverse 047_store_branches
DROP TABLE IF EXISTS store_settings;
-- Note: SQLite cannot drop columns added via ALTER TABLE (phone, email, manager_id, opening_hours, currency, tax_rate, is_primary on locations)
