-- 005_refresh_token_rotation.sql
-- Issue #44: refresh tokens are stored in plaintext and never rotate.
--
-- `refresh_tokens.token` held the signed JWT verbatim, so a read of this one
-- table -- a backup, a log shipper, a SQL injection anywhere else in the
-- schema -- handed the reader working 7-day sessions for every logged-in user.
-- Nothing about the row was a secret derived from the token; the row WAS the
-- token. This migration replaces it with a digest and gives each session a
-- lineage that can be revoked as a unit.
--
-- Columns:
--
--  token_hash        SHA-256 of the presented token, hex. Uniquely indexed,
--                    because lookup is now "digest what the caller presented and
--                    match on it" -- there is no plaintext left to compare
--                    against. SHA-256 and not bcrypt on purpose: a refresh token
--                    is a 300+ character signed JWT with a random jti, not a
--                    human-chosen password, so there is no dictionary to slow
--                    down. bcrypt's work factor would buy nothing against a
--                    preimage of that entropy and would put ~100ms of CPU on
--                    every refresh -- and, being salted, would make lookup a
--                    full-table scan instead of an index probe.
--
--  family_id         One session's lineage. Every rotation inserts a new row
--                    carrying the family_id of the row it replaced, so the whole
--                    chain descending from one login is revocable as a unit.
--                    That is what makes reuse detection actionable: presenting
--                    an already-rotated token means either a thief or the
--                    legitimate holder is using a copy, and the safe response is
--                    to kill the entire lineage, not just the one row.
--
--  revoked_at /      Why a row stopped being usable, and when. A row is never
--  revoked_reason    deleted at revocation: reuse detection needs to distinguish
--                    "token I have never seen" (401, nothing to revoke) from
--                    "token I invalidated 20 minutes ago" (401 AND revoke the
--                    family), and a deleted row cannot tell those apart. Rows
--                    are cleaned up only once expires_at has passed, at which
--                    point the JWT's own exp rejects the token first anyway.
--                    'rotated' is also what distinguishes an honest same-second
--                    replay from theft -- see REFRESH_ROTATION_GRACE_SECONDS.
--
--  replaced_by_hash  Digest of the successor. Audit only: it lets an operator
--                    walk a family forward without guessing.
--
-- Existing rows are DELETED rather than backfilled. Their digests could be
-- computed here, but every one of those tokens has been sitting in plaintext in
-- this table and in every backup taken of it; carrying them forward would
-- preserve exactly the exposure this migration exists to end. The cost is that
-- everyone logs in again once, at their next refresh. Access tokens already
-- issued keep working for their remaining <=15 minutes, so nobody is interrupted
-- mid-transaction.

DELETE FROM refresh_tokens;

ALTER TABLE refresh_tokens ADD COLUMN token_hash TEXT;
ALTER TABLE refresh_tokens ADD COLUMN family_id TEXT;
ALTER TABLE refresh_tokens ADD COLUMN revoked_at TIMESTAMPTZ;
ALTER TABLE refresh_tokens ADD COLUMN revoked_reason TEXT;
ALTER TABLE refresh_tokens ADD COLUMN replaced_by_hash TEXT;

-- The plaintext column is the defect. Dropping it is what makes "a plaintext
-- refresh token is never persisted" true by construction rather than by review.
ALTER TABLE refresh_tokens DROP COLUMN token;

ALTER TABLE refresh_tokens ALTER COLUMN token_hash SET NOT NULL;
ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;

ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);

-- Revoking a family and finding its live head are both keyed on family_id, and
-- both sit on the refresh path.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens (family_id);

-- Global revocation ("log this user out everywhere") scans by user.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);

-- Supports the cleanup DELETE ... WHERE expires_at < NOW().
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
