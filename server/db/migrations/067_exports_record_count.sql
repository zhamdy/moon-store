-- The exports route records how many rows an export produced, but the column
-- was never created, so every generate request failed on the insert.
ALTER TABLE exports ADD COLUMN record_count INTEGER NOT NULL DEFAULT 0;
