-- Reverses 019. A real reversal and lossless: a constraint holds no data, and dropping it
-- restores the state where a zero variant price could be stored again.

ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_price_positive;
