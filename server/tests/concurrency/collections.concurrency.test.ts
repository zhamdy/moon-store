/**
 * Collection position invariants under genuine concurrency (#68).
 *
 * `addProducts` computes the next slot as `MAX(position) + 1`. Under READ COMMITTED that
 * is a race on its own: two transactions can each read the same MAX before either
 * commits, and both aim for the same slot. The repository serializes them by locking the
 * parent `collections` row with `SELECT ... FOR UPDATE` first.
 *
 * This cannot be proven on pg-mem — it has no MVCC, so two "concurrent" writers there are
 * really sequential and the buggy version would pass. The first case below fails against
 * a repository without the lock (both appenders land on the same position, and the unique
 * constraint turns one of them into a 23505); the third case demonstrates exactly that,
 * by reproducing the unlocked read-then-write by hand.
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  describeWithPostgres,
  setupRealPostgres,
  type RealPostgresHarness,
} from '../support/realPostgres';
import { CollectionsRepository } from '../../src/modules/inventory/collections/repository';
import { CollectionsService } from '../../src/modules/inventory/collections/service';
import { withTransaction, type Queryable } from '../../src/database/transaction';

describeWithPostgres('collection product position under concurrency', () => {
  let harness: RealPostgresHarness;
  let collectionId: number;
  let productIds: number[];
  const repo = new CollectionsRepository();
  const service = new CollectionsService(repo);

  beforeAll(async () => {
    // Four simultaneous appenders plus margin. Larger competes with the other real-PG
    // files for max_connections and surfaces as opaque connection timeouts.
    harness = await setupRealPostgres('collections-concurrency', { maxConnections: 6 });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  beforeEach(async () => {
    await harness.truncate();

    const collections = await harness.pool.query<{ id: number }>(
      "INSERT INTO collections (name) VALUES ('Autumn window') RETURNING id"
    );
    collectionId = collections.rows[0].id;

    const products = await harness.pool.query<{ id: number }>(
      `INSERT INTO products (name, sku, price, stock)
       VALUES ('p1','SKU-1',10,1), ('p2','SKU-2',10,1), ('p3','SKU-3',10,1), ('p4','SKU-4',10,1)
       RETURNING id`
    );
    productIds = products.rows.map((p) => p.id);
  });

  const positions = async (): Promise<number[]> => {
    const { rows } = await harness.pool.query<{ position: number }>(
      'SELECT position FROM collection_products WHERE collection_id = $1 ORDER BY position ASC',
      [collectionId]
    );
    return rows.map((r) => r.position);
  };

  const orderedProducts = async (): Promise<number[]> => {
    const { rows } = await harness.pool.query<{ product_id: number }>(
      'SELECT product_id FROM collection_products WHERE collection_id = $1 ORDER BY position ASC',
      [collectionId]
    );
    return rows.map((r) => r.product_id);
  };

  it('gives four simultaneous appenders four distinct consecutive slots', async () => {
    const results = await Promise.allSettled(
      productIds.map((productId) =>
        withTransaction(
          (client) => repo.addProducts(collectionId, [productId], client),
          harness.pool
        )
      )
    );

    // Every appender succeeds. A rejection here would mean the lock did not serialize
    // them and the unique constraint caught the collision instead — correct data, but a
    // 500 for an admin who did nothing wrong.
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected.map((r) => (r as PromiseRejectedResult).reason)).toEqual([]);

    expect(await positions()).toEqual([0, 1, 2, 3]);
  });

  it('appends after a concurrent batch rather than overlapping it', async () => {
    const [first, second] = [productIds.slice(0, 2), productIds.slice(2)];

    await Promise.all([
      withTransaction((client) => repo.addProducts(collectionId, first, client), harness.pool),
      withTransaction((client) => repo.addProducts(collectionId, second, client), harness.pool),
    ]);

    // Which batch wins the lock is genuinely nondeterministic; that both batches stay
    // contiguous and no slot is shared is not.
    expect(await positions()).toEqual([0, 1, 2, 3]);

    const { rows } = await harness.pool.query<{ product_id: number; position: number }>(
      'SELECT product_id, position FROM collection_products WHERE collection_id = $1 ORDER BY position',
      [collectionId]
    );
    const ordered = rows.map((r) => r.product_id);
    // A batch is never interleaved with the other: the lock is held for the whole call.
    expect([
      [...first, ...second],
      [...second, ...first],
    ]).toContainEqual(ordered);
  });

  // ── Reorder: the case the non-deferrable UNIQUE constraint has to survive ──────
  //
  // `service.update` replaces the whole product set — delete every row, re-insert from
  // slot 0 — inside one transaction. The argument for making the constraint IMMEDIATE
  // rather than DEFERRABLE is that this never puts two live rows on one slot, because the
  // delete precedes every insert. That argument is only worth as much as a test on an
  // engine that actually enforces unique constraints per statement, which pg-mem does not.
  // If it were wrong, every collection edit would 500.

  it('renumbers a full reorder from zero without tripping the unique constraint', async () => {
    await repo.addProducts(collectionId, productIds.slice(0, 3));

    // A rotation, deliberately: every product moves to a slot another product currently
    // occupies, so a constraint checked before the delete became visible would fire.
    const rotated = [productIds[2], productIds[0], productIds[1]];
    const result = await service.update(collectionId, {
      name: 'Autumn window',
      product_ids: rotated,
    });

    expect(result.success).toBe(true);
    expect(await positions()).toEqual([0, 1, 2]);
    expect(await orderedProducts()).toEqual(rotated);
  });

  it('reverses a collection, the worst case for slot reuse', async () => {
    await repo.addProducts(collectionId, productIds);

    const reversed = [...productIds].reverse();
    await service.update(collectionId, { name: 'Autumn window', product_ids: reversed });

    expect(await positions()).toEqual([0, 1, 2, 3]);
    expect(await orderedProducts()).toEqual(reversed);
  });

  it('survives a reorder racing an append', async () => {
    await repo.addProducts(collectionId, productIds.slice(0, 3));
    const rotated = [productIds[2], productIds[0], productIds[1]];

    const results = await Promise.allSettled([
      service.update(collectionId, { name: 'Autumn window', product_ids: rotated }),
      withTransaction(
        (client) => repo.addProducts(collectionId, [productIds[3]], client),
        harness.pool
      ),
    ]);

    // Neither caller may see a 23505 — that is the claim under test.
    expect(
      results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason)
    ).toEqual([]);

    // Which caller wins the collections row lock is genuinely nondeterministic, and the
    // three reachable outcomes differ in both membership and starting slot:
    //
    //   - update commits first, then the append lands after it        -> slots 0,1,2,3
    //   - the append commits first and update's DELETE then sees it   -> slots 0,1,2
    //   - the append commits between update's DELETE and its inserts  -> slots 3,4,5,6
    //
    // The middle outcome DROPS the appended product. That is not a defect this PR
    // introduces or that `position` causes: `PUT /api/v1/collections/:id` replaces the
    // whole product set, so a reorder legitimately removes anything it did not list, and
    // the loser of the race is whoever's read was stale. Last-writer-wins on a whole-set
    // replace is a pre-existing property of the endpoint. Asserting a fixed membership
    // here would encode one scheduling outcome as if it were the contract.
    //
    // So the assertions are on what must hold in every outcome.
    const slots = await positions();
    // Distinct: the unique constraint held and no two products share a slot.
    expect(new Set(slots).size).toBe(slots.length);
    // Contiguous: whichever writer went second appended onto the other's run rather than
    // interleaving into it.
    expect(slots).toEqual(slots.map((_, i) => slots[0] + i));

    const finalProducts = await orderedProducts();
    // Every surviving product is one of ours, and the reorder's curated sequence is
    // intact — a concurrent append may sit after it, never inside it.
    expect(finalProducts.every((id) => productIds.includes(id))).toBe(true);
    expect(finalProducts.filter((id) => rotated.includes(id))).toEqual(rotated);
  });

  it('makes a second appender wait for the first transaction to commit', async () => {
    // The lock, demonstrated rather than inferred. Interleaved by hand on two dedicated
    // connections so the ordering is deterministic, not a matter of scheduling luck.
    const first = await harness.connect();
    const second = await harness.connect();

    try {
      await first.query('BEGIN');
      await repo.addProducts(collectionId, [productIds[0]], first);

      await second.query('BEGIN');
      let secondSettled = false;
      const secondAppend = repo
        .addProducts(collectionId, [productIds[1]], second)
        .then(() => {
          secondSettled = true;
        });

      // The second appender is parked on the collections row lock. If it had not been —
      // if `addProducts` read MAX without locking — it would have completed here, having
      // read a MAX that excludes the first appender's uncommitted row.
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(secondSettled).toBe(false);

      await first.query('COMMIT');
      await secondAppend;
      await second.query('COMMIT');

      expect(await positions()).toEqual([0, 1]);
      const { rows } = await harness.pool.query<{ product_id: number }>(
        'SELECT product_id FROM collection_products WHERE collection_id = $1 ORDER BY position',
        [collectionId]
      );
      expect(rows.map((r) => r.product_id)).toEqual([productIds[0], productIds[1]]);
    } finally {
      first.release();
      second.release();
    }
  });

  it('is the row lock, not luck: the same insert without it collides on the constraint', async () => {
    // The control, interleaved by hand for determinism. This is `addProducts` minus the
    // `FOR UPDATE`: both transactions read a MAX that excludes the other's uncommitted
    // row, so both aim for slot 0. It proves the race is real and that the unique
    // constraint is a genuine backstop rather than decoration. If this ever stops
    // failing, the tests above have stopped proving anything.
    const unlockedAppend = (client: Queryable, productId: number) =>
      client.query(
        `INSERT INTO collection_products (collection_id, product_id, position)
         SELECT $1::int, $2::int, COALESCE(MAX(cp.position) + 1, 0)
           FROM collection_products cp
          WHERE cp.collection_id = $1::int`,
        [collectionId, productId]
      );

    const first = await harness.connect();
    const second = await harness.connect();

    try {
      await first.query('BEGIN');
      await unlockedAppend(first, productIds[0]);

      await second.query('BEGIN');
      // Blocks on the unique index against the first transaction's uncommitted slot 0,
      // then resolves into a 23505 the moment that transaction commits.
      const collision = unlockedAppend(second, productIds[1]);
      // Give that INSERT time to reach the server and park on the index. Without the
      // pause, COMMIT can land first, the second transaction then reads MAX = 0, and the
      // collision this test exists to demonstrate never happens.
      await new Promise((resolve) => setTimeout(resolve, 250));

      await first.query('COMMIT');

      await expect(collision).rejects.toMatchObject({
        code: '23505',
        constraint: 'collection_products_position_unique',
      });
      await second.query('ROLLBACK');

      expect(await positions()).toEqual([0]);
    } finally {
      first.release();
      second.release();
    }
  });
});
