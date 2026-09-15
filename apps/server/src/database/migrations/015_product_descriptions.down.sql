-- Reverses 015. A real reversal, not a no-op.
--
-- Lossy, like 014: any description an admin has entered is discarded on rollback and is
-- not derivable from anything else.

ALTER TABLE products DROP COLUMN IF EXISTS description_en;
ALTER TABLE products DROP COLUMN IF EXISTS description;
