-- Gives store credit somewhere to live.
--
-- `exchanges.payment_method` has always accepted `store_credit`, and `writeExchange`
-- defaults to it whenever an exchange leaves the shop owing the customer money. But no
-- code wrote a balance anywhere: there was no table, no ledger, and no way to spend it.
-- An exchange that owed the customer recorded that fact and then lost it, and the
-- customer's only recourse was that somebody remembered (#138).
--
-- A ledger rather than a balance column on `customers`, for the reason ledgers usually
-- win: a single mutable number can be wrong with no way to find out when or why, while
-- a sum over immutable rows can always be explained. `delta` is positive when credit is
-- issued and negative when it is spent, and the balance is SUM(delta) -- which also means
-- there is no separate number that can drift out of step with the entries.
--
-- No expiry. Credit is money the shop already owes, and an expiring balance is both a
-- customer complaint and a jurisdiction question; if that changes, an `expires_at` column
-- and a sweep can be added without reshaping what is here.
CREATE TABLE IF NOT EXISTS customer_credit_ledger (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  -- Positive issues credit, negative spends it. CHECKed as non-zero because an entry
  -- that moves nothing is a bug in the caller, not a balance of nothing.
  delta NUMERIC NOT NULL CHECK (delta <> 0),
  reason TEXT NOT NULL,
  -- What caused this movement, so any entry can be traced back to the exchange, refund or
  -- sale it came from. TEXT rather than a foreign key because the three sources live in
  -- different tables.
  source_type TEXT NOT NULL CHECK (source_type IN ('exchange', 'refund', 'sale', 'manual')),
  source_id TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_customer ON customer_credit_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_source ON customer_credit_ledger(source_type, source_id);
