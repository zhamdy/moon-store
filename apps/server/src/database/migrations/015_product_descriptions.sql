-- Adds `description` / `description_en` to products (plan 2026-09-14-003, Unit A).
--
-- Additive and nullable, no backfill, no CHECK: unlike 014's slug backfill, there is
-- nothing to derive these from, and nothing here rewrites an existing row, so the 014
-- NOT VALID CHECK caveat does not apply. `description` stays the primary (Arabic) field,
-- `description_en` optional, the same split `name`/`name_en` already use.

ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_en TEXT;
