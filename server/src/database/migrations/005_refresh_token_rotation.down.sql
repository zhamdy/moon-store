-- 005_refresh_token_rotation.down.sql
--
-- Restores the plaintext-token shape. There is nothing to restore INTO it: a
-- digest cannot be reversed, so every session is dropped on the way down just as
-- it was on the way up. Rolling back therefore logs everyone out, which is the
-- honest outcome -- the alternative would be inventing token values.
DELETE FROM refresh_tokens;

DROP INDEX IF EXISTS idx_refresh_tokens_expires_at;
DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
DROP INDEX IF EXISTS idx_refresh_tokens_family_id;

ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_token_hash_key;

ALTER TABLE refresh_tokens ADD COLUMN token TEXT;
ALTER TABLE refresh_tokens ALTER COLUMN token SET NOT NULL;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);

ALTER TABLE refresh_tokens DROP COLUMN replaced_by_hash;
ALTER TABLE refresh_tokens DROP COLUMN revoked_reason;
ALTER TABLE refresh_tokens DROP COLUMN revoked_at;
ALTER TABLE refresh_tokens DROP COLUMN family_id;
ALTER TABLE refresh_tokens DROP COLUMN token_hash;
