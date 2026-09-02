-- 006_collection_product_position.sql
-- Fixes #68: `CollectionsRepository` has always selected, ordered by, and inserted
-- `collection_products.position`, but 001_initial_schema.sql never created the column.
-- `GET /api/v1/collections/:id` and every write that touches the join table raised
-- `42703 undefined_column` and surfaced as a 500. The list endpoint never reads the
-- column, which is why the bug stayed invisible until #72 routed the Collections page.
--
-- The fix adds the column rather than deleting the ORDER BY. A collection is a
-- merchandising surface: the order products appear in is the editorial decision the
-- feature exists to express. Dropping it to match the schema would have been discarding
-- a feature to fix a bug.
--
-- Three decisions worth stating, because none of them is recoverable from the SQL alone.
--
-- 1. BACKFILL — `product_id ASC`, dense from 0, per collection.
--
--    Existing rows carry no order at all: the table has no created_at, no surrogate key,
--    and PostgreSQL heap order is not insertion order (an UPDATE moves a row). The order
--    a merchandiser originally chose is simply gone. So the only honest choice is a
--    deterministic, reproducible one rather than a guess that pretends to be the original
--    intent. `product_id ASC` is stable, gives the same result on every environment the
--    migration is applied to, and — being obviously arbitrary — invites a merchandiser to
--    re-curate rather than trusting an order nobody chose.
--
--    Expressed as a self-join COUNT rather than ROW_NUMBER() OVER (): the pg-mem engine
--    behind most test suites implements no window functions, and this migration is not
--    worth a second rewrite shim in tests/support/pgMem.ts. The two are equivalent here
--    (product_id is unique within a collection by the primary key, so the rank has no
--    ties) and the cost difference is irrelevant for a one-shot backfill of a join table.
--
-- 2. DENSE, NOT SPARSE. Positions are assigned contiguously from 0. A reorder is
--    therefore a rewrite of every row in the collection, not an insert between two gaps.
--    That is the right trade at this scale — a collection is a curated shop window
--    holding tens of products, not thousands — and the existing reorder path already
--    rewrites the whole set (`update()` deletes every row and re-inserts in the order the
--    caller supplied), so nothing gets slower.
--
--    Density is maintained on the collections module's own write paths, but it is NOT an
--    invariant of the table: `product_id REFERENCES products(id) ON DELETE CASCADE` means
--    deleting a product silently removes its row and leaves a gap. That is harmless and
--    deliberately not repaired. Consumers depend on relative ORDER, not on contiguity,
--    and an append computed as MAX(position) + 1 keeps working across a gap. Repairing it
--    would mean a trigger rewriting unrelated collections on every product delete.
--
-- 3. UNIQUE (collection_id, position) — the invariant made enforceable.
--
--    Two admins appending to the same collection concurrently must not both land on the
--    same slot. The application serializes them by locking the parent `collections` row
--    (`SELECT id FROM collections WHERE id = $1 FOR UPDATE`) before computing the next
--    position; this constraint is what makes a future code path that forgets the lock
--    fail loudly at the database (23505) instead of silently producing two products with
--    the same position and a non-deterministic display order.
--
--    Non-deferrable on purpose. A deferred constraint would permit a `position + 1` bulk
--    shift, but no path in this codebase does one — the reorder is delete-then-reinsert
--    inside a single transaction, which never has two live rows on one slot — and an
--    IMMEDIATE constraint fails at the offending statement rather than at COMMIT, which
--    is far easier to diagnose.

ALTER TABLE collection_products ADD COLUMN IF NOT EXISTS position INTEGER;

-- Deterministic backfill: each row's position is how many rows in the same collection
-- have a smaller product_id. A no-op on a fresh database, where the table is empty.
UPDATE collection_products
   SET position = ranked.rank
  FROM (
         SELECT entry.collection_id AS collection_id,
                entry.product_id AS product_id,
                COUNT(earlier.product_id)::int AS rank
           FROM collection_products entry
           LEFT JOIN collection_products earlier
             ON earlier.collection_id = entry.collection_id
            AND earlier.product_id < entry.product_id
          GROUP BY entry.collection_id, entry.product_id
       ) ranked
 WHERE collection_products.collection_id = ranked.collection_id
   AND collection_products.product_id = ranked.product_id;

ALTER TABLE collection_products ALTER COLUMN position SET NOT NULL;

ALTER TABLE collection_products
  ADD CONSTRAINT collection_products_position_unique UNIQUE (collection_id, position);
