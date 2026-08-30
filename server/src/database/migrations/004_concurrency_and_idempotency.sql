-- 004_concurrency_and_idempotency.sql
-- Unit 2 of the POS concurrency/idempotency fix (see
-- docs/plans/2026-08-30-002-fix-pos-concurrency-idempotency-plan.md, "Unit 2").
--
-- Two additions, both additive and online — a new table plus four NOT VALID
-- check constraints. No table rewrite, no lock on a large table.
--
-- 1. `idempotency_keys` — a caller-supplied Idempotency-Key claims a row as the
--    FIRST statement inside the business transaction. The unique primary key on
--    `key` is what makes "exactly one committed outcome per key" true by
--    construction: a duplicate blocks on the index until the first transaction
--    ends, then either sees 23505 (winner committed -> replay the stored
--    response) or acquires the claim itself (winner rolled back -> proceed).
--    Because the claim shares the transaction's fate, a FAILED mutation leaves
--    no row and the client may retry the same key. A key therefore identifies a
--    committed outcome, never an attempt.
--
--    Uniqueness is global, and `endpoint` / `user_id` / `request_fingerprint`
--    are validated rather than keyed, so a key replayed against a different
--    endpoint or user is a deterministic conflict instead of a cross-endpoint
--    collision. The stored `response_body` is replayed byte-identically, so a
--    retried request never observes a different outcome than the first.
--
-- 2. Non-negative floors as CHECK ... NOT VALID. The application guards
--    (guarded relative UPDATEs, row locks) are the real mechanism; these are
--    defense-in-depth so that a future code path which forgets the guard fails
--    loudly at the database instead of silently corrupting inventory or a
--    balance.
--
--    NOT VALID because existing rows may already be negative — nothing has been
--    guarding exchanges — and this migration must not fail on legacy data. New
--    and updated rows ARE enforced; only the retroactive full-table scan is
--    skipped. To find pre-existing violators before promoting these:
--
--      SELECT 'products' AS t, id, stock AS v FROM products WHERE stock < 0
--      UNION ALL SELECT 'product_variants', id, stock FROM product_variants WHERE stock < 0
--      UNION ALL SELECT 'gift_cards', id, balance FROM gift_cards WHERE balance < 0
--      UNION ALL SELECT 'customers', id, loyalty_points FROM customers WHERE loyalty_points < 0;
--
--    Once that returns no rows, `ALTER TABLE <t> VALIDATE CONSTRAINT <c>` is the
--    operational follow-up. It takes only a SHARE UPDATE EXCLUSIVE lock and does
--    not block reads or writes.

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  request_fingerprint TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  resource_type TEXT,
  resource_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Supports both the opportunistic delete of an expired row during a claim
-- collision and a future scheduled DELETE ... WHERE expires_at < NOW().
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys (expires_at);

-- Lets an operator trace a key back to the row it produced without parsing JSON.
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_resource
  ON idempotency_keys (resource_type, resource_id);

-- ADD CONSTRAINT has no IF NOT EXISTS. It does not need one: the migration
-- runner applies each file at most once, and the paired .down.sql drops these,
-- so up/down/up is clean. A plpgsql DO guard would only cost pg-mem support.
ALTER TABLE products
  ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0) NOT VALID;

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_stock_non_negative CHECK (stock >= 0) NOT VALID;

ALTER TABLE gift_cards
  ADD CONSTRAINT gift_cards_balance_non_negative CHECK (balance >= 0) NOT VALID;

-- loyalty_points is nullable; a CHECK passes on NULL, which is the intent.
ALTER TABLE customers
  ADD CONSTRAINT customers_loyalty_points_non_negative CHECK (loyalty_points >= 0) NOT VALID;
