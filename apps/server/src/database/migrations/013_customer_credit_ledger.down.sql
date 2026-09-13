-- Reverses 013 by dropping the table it created. A real reversal, not a no-op.
--
-- This one IS lossy, unlike 011 and 012: nothing derives these rows from anywhere else,
-- so a rollback discards real balances the shop owes real customers. There is nothing to
-- be done about that in SQL -- the alternative would be to refuse to roll back at all --
-- but take a dump of `customer_credit_ledger` before running it in production.
DROP TABLE IF EXISTS customer_credit_ledger;
