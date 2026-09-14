-- Reverses 016. A real reversal, not a no-op.
--
-- Lossy, like 015: any material, care or fit text an admin has entered is discarded on
-- rollback and is not derivable from anything else.

ALTER TABLE products DROP COLUMN IF EXISTS fit_en;
ALTER TABLE products DROP COLUMN IF EXISTS fit;
ALTER TABLE products DROP COLUMN IF EXISTS care_en;
ALTER TABLE products DROP COLUMN IF EXISTS care;
ALTER TABLE products DROP COLUMN IF EXISTS material_en;
ALTER TABLE products DROP COLUMN IF EXISTS material;
