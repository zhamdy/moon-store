-- Reverses 010: maps the application spellings that only 010 introduced back to their
-- 009-era equivalents, then restores the 009 constraint list verbatim. The mapping is
-- total and information-preserving in both directions, so this is a real reversal, not a
-- no-op -- Draft/Received/Cancelled are shared by both lists and pass through unchanged.
--
-- The constraint is dropped before the remap, mirroring 010.sql: 010's own list never
-- admitted 'Ordered' or 'Partial', so writing them back while that constraint is still
-- live would itself be a CHECK violation.
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

UPDATE purchase_orders
SET status = CASE status
  WHEN 'Sent' THEN 'Ordered'
  WHEN 'Partially Received' THEN 'Partial'
  ELSE status
END;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('Draft', 'Ordered', 'Partial', 'Received', 'Cancelled', 'pending', 'received', 'cancelled'))
  NOT VALID;
