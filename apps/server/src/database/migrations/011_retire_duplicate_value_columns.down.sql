-- Reverses 011 by restoring both columns exactly as 001 declared them: NUMERIC, nullable,
-- DEFAULT 0. That is a real reversal of the schema, so this is not a no-op.
--
-- It cannot restore the values they held, and deliberately does not invent any. Both
-- columns are re-created holding their DEFAULT rather than, say, a copy of `total` or
-- `bundle_price` -- a rollback should put the schema back, not write data that was never
-- there. Nothing was reading either column before 011, and the rows they held were the
-- defaults the writers never updated, so there is nothing a consumer can miss.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;

ALTER TABLE product_bundles ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
