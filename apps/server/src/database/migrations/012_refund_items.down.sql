-- Reverses 012 by dropping the table it created. A real reversal, not a no-op.
--
-- Nothing is lost: 012 derived every row from `refunds.items`, which this migration
-- never touched and which the application keeps writing, so the same rollback can be
-- re-applied and produce the same table again. Retiring the blob is a separate change
-- and must not land before this one is proven.
DROP TABLE IF EXISTS refund_items;
