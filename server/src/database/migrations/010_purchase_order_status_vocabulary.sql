-- Narrows purchase_orders_status_check to the vocabulary the application already speaks.
--
-- 009 widened the CHECK to tolerate every legacy spelling it found ('pending', 'received',
-- 'cancelled', 'Ordered', 'Partial') alongside the application's own ('Draft', 'Sent',
-- 'Partially Received', 'Received', 'Cancelled'). The Zod enum, the TS union, the client
-- chips/filters and the i18n keys have used the application spellings all along -- 'Sent'
-- and 'Partially Received' were never actually reachable through 009's CHECK, so a status
-- write past 'Draft' has been failing with an unmapped 23514 since 009 shipped.
--
-- The old (009) constraint is dropped before the backfill, not after: 009's list never
-- admitted 'Sent' or 'Partially Received' at all, so remapping 'Ordered' -> 'Sent' while
-- that constraint is still live would itself be a CHECK violation. Nothing else writes to
-- this table mid-migration -- the whole thing runs in one transaction -- so the brief gap
-- with no constraint is not observable outside it. The new constraint is then added
-- validated (no NOT VALID) because the backfill immediately above guarantees every row
-- already conforms; 009 used NOT VALID specifically to avoid validating rows it had not
-- yet repaired, which does not apply here.
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

UPDATE purchase_orders
SET status = CASE status
  WHEN 'Ordered' THEN 'Sent'
  WHEN 'Partial' THEN 'Partially Received'
  WHEN 'pending' THEN 'Draft'
  WHEN 'received' THEN 'Received'
  WHEN 'cancelled' THEN 'Cancelled'
  ELSE status
END;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('Draft', 'Sent', 'Partially Received', 'Received', 'Cancelled'));
