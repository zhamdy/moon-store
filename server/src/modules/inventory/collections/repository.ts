import { Queryable, withTransaction } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  CollectionRecord,
  CollectionProductRecord,
  CollectionFilters,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from './types';

export interface ICollectionsRepository {
  list(
    filters: CollectionFilters,
    queryable?: Queryable
  ): Promise<{ rows: CollectionRecord[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<CollectionRecord | null>;
  findProductsByCollectionId(
    collectionId: number | string,
    queryable?: Queryable
  ): Promise<CollectionProductRecord[]>;
  create(data: CreateCollectionDTO, queryable?: Queryable): Promise<CollectionRecord>;
  update(
    id: number | string,
    data: UpdateCollectionDTO,
    queryable?: Queryable
  ): Promise<CollectionRecord | null>;
  deleteProductsByCollectionId(collectionId: number | string, queryable?: Queryable): Promise<void>;
  addProducts(
    collectionId: number | string,
    productIds: number[],
    queryable?: Queryable
  ): Promise<void>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class CollectionsRepository implements ICollectionsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: CollectionFilters,
    queryable?: Queryable
  ): Promise<{ rows: CollectionRecord[]; total: number }> {
    const { season, featured, page, pageSize, sortBy, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = sortBy === 'name' ? 'c.name' : 'c.created_at';
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (season) {
      params.push(season);
      where += ` AND c.season = $${params.length}`;
    }
    if (featured !== undefined) {
      params.push(featured ? 1 : 0);
      where += ` AND c.is_featured = $${params.length}`;
    }

    const count = await this.q(queryable).query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM collections c ${where}`,
      params
    );
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const collections = await this.q(queryable).query<CollectionRecord>(
      `SELECT c.id, c.name, c.description, c.image_url, c.is_featured, c.season, c.status, c.created_at, c.updated_at,
              COUNT(cp.product_id)::int as product_count
       FROM collections c
       LEFT JOIN collection_products cp ON cp.collection_id = c.id
       ${where}
       GROUP BY c.id, c.name, c.description, c.image_url, c.is_featured, c.season, c.status, c.created_at, c.updated_at
       ORDER BY ${sortColumn} ${direction}, c.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return { rows: collections.rows, total: Number(count.rows[0]?.total ?? 0) };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<CollectionRecord | null> {
    const res = await this.q(queryable).query<CollectionRecord>(
      'SELECT * FROM collections WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async findProductsByCollectionId(
    collectionId: number | string,
    queryable?: Queryable
  ): Promise<CollectionProductRecord[]> {
    const res = await this.q(queryable).query<CollectionProductRecord>(
      `SELECT p.*, cp.position
       FROM collection_products cp
       JOIN products p ON cp.product_id = p.id
       WHERE cp.collection_id = $1
       ORDER BY cp.position ASC`,
      [collectionId]
    );
    return res.rows;
  }

  async create(data: CreateCollectionDTO, queryable?: Queryable): Promise<CollectionRecord> {
    const res = await this.q(queryable).query<CollectionRecord>(
      `INSERT INTO collections (name, description, season, is_featured)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name, data.description || null, data.season || null, data.is_featured ? 1 : 0]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateCollectionDTO,
    queryable?: Queryable
  ): Promise<CollectionRecord | null> {
    const res = await this.q(queryable).query<CollectionRecord>(
      `UPDATE collections SET name = $1, description = $2, season = $3, is_featured = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [data.name, data.description || null, data.season || null, data.is_featured ? 1 : 0, id]
    );
    return res.rows[0] || null;
  }

  async deleteProductsByCollectionId(
    collectionId: number | string,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query('DELETE FROM collection_products WHERE collection_id = $1', [
      collectionId,
    ]);
  }

  /**
   * Appends products to a collection, each at the next free position.
   *
   * The position is computed as `MAX(position) + 1` *inside the INSERT*, so it is read
   * and written in one statement rather than in a read-then-write pair the caller could
   * interleave with. That alone is not enough under READ COMMITTED: two concurrent
   * transactions can each read the same MAX before either commits, and both would aim for
   * the same slot. So the parent `collections` row is locked first — `FOR UPDATE` blocks
   * the second appender until the first commits, at which point its MAX is visible.
   *
   * The `UNIQUE (collection_id, position)` constraint from migration 006 is the backstop,
   * not the mechanism: if a future caller reaches this table without the lock, it gets a
   * loud 23505 instead of two products silently sharing a slot.
   *
   * The lock is only a lock for the life of a transaction, so when no queryable is passed
   * this opens one. A bare pooled query would release the row lock at statement end and
   * the guarantee would quietly evaporate.
   */
  async addProducts(
    collectionId: number | string,
    productIds: number[],
    queryable?: Queryable
  ): Promise<void> {
    if (productIds.length === 0) return;

    const run = async (q: Queryable): Promise<void> => {
      await q.query('SELECT id FROM collections WHERE id = $1 FOR UPDATE', [collectionId]);

      for (const productId of productIds) {
        await q.query(
          `INSERT INTO collection_products (collection_id, product_id, position)
           SELECT $1::int, $2::int, COALESCE(MAX(cp.position) + 1, 0)
             FROM collection_products cp
            WHERE cp.collection_id = $1::int`,
          [collectionId, productId]
        );
      }
    };

    if (queryable) {
      await run(queryable);
      return;
    }
    await withTransaction((client) => run(client));
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM collections WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }
}

export const collectionsRepository = new CollectionsRepository();
