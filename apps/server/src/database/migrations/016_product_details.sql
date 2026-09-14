-- Adds `material`, `care` and `fit` (each with an `_en` twin) to products, for the
-- storefront product page's Details tab.
--
-- Additive and nullable, no backfill, no CHECK: there is nothing to derive these from,
-- and nothing here rewrites an existing row, so the 014 NOT VALID CHECK caveat does not
-- apply. The unsuffixed column stays the primary (Arabic) field and `_en` optional, the
-- same split `name`/`name_en` and `description`/`description_en` already use.

ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS material_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS care TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS care_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS fit TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS fit_en TEXT;
