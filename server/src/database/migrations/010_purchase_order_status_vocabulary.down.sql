-- Reverses 010: maps the application spellings that only 010 introduced back to their
-- 009-era equivalents, then restores the 009 constraint list verbatim. This is a real
-- reversal, not a no-op -- Draft/Received/Cancelled are shared by both lists and pass
-- through unchanged, and 'Sent'/'Partially Received' return to their exact 009 spellings.
--
-- It is not lossless the other way: 010's forward map is many-to-one for three legacy
-- spellings ('pending'/'received'/'cancelled' each collapse into an existing TitleCase
-- value), so a row stored as 'received' before 010 comes back from this rollback as
-- 'Received', not 'received'. Both spellings are valid under the 009 list this restores,
-- and 'Draft'/'Sent'/'Partially Received'/'Received'/'Cancelled' round-trip exactly --
-- only the three lowercase legacy spellings do not.
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
