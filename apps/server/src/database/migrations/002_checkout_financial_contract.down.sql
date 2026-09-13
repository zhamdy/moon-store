-- 002_checkout_financial_contract.down.sql
-- Intentionally a no-op.
--
-- This migration's up script never overwrites or deletes a setting; it only
-- inserts a canonical loyalty key when that exact key was entirely absent.
-- Because `settings` is a plain key/value table with no bookkeeping of which
-- migration introduced which row, there is no reliable way to distinguish
-- "a row this migration inserted" from "a row an operator or another process
-- configured immediately afterward" without adding such bookkeeping (out of
-- scope for this migration).
--
-- Per the plan's own migration risk guidance, rollback "removes only values
-- proven to have been introduced by this migration and must not destroy a
-- pre-existing canonical value." Since that proof is unavailable here, the
-- only safe rollback is to change nothing: a canonical loyalty setting is
-- configuration data, and deleting it destructively on a guess would be
-- strictly worse than leaving a harmless default in place.

-- Syntactic no-op so the migration runner has a valid statement to execute.
SELECT 1;
