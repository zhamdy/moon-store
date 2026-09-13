import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  BundleRecord,
  BundleItemRecord,
  BundleFilters,
  CreateBundleDTO,
  UpdateBundleDTO,
  BundleItemDTO,
} from './types';

/**
 * Derives the two figures the client declares non-optional from the two the database
 * supplies. Computed here rather than in the client so the bundle's arithmetic has one
 * authority, the same reason checkout re-prices every line server-side.
 */
export function withSavings(row: BundleRecord): BundleRecord {
  const price = Number(row.price ?? 0);
  const original = Number(row.original_price ?? 0);
  const savings = Math.max(0, original - price);
  return {
    ...row,
    price,
    original_price: original,
    savings,
    savings_percent: original > 0 ? Math.round((savings / original) * 100) : 0,
  };
}

export interface IBundlesRepository {
  list(
    filters: BundleFilters,
    queryable?: Queryable
  ): Promise<{ rows: BundleRecord[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<BundleRecord | null>;
  findItemsByBundleId(
    bundleId: number | string,
    queryable?: Queryable
  ): Promise<BundleItemRecord[]>;
  findItemsByBundleIds(bundleIds: number[], queryable?: Queryable): Promise<BundleItemRecord[]>;
  create(data: CreateBundleDTO, queryable?: Queryable): Promise<BundleRecord>;
  update(
    id: number | string,
    data: UpdateBundleDTO,
    queryable?: Queryable
  ): Promise<BundleRecord | null>;
  deleteItemsByBundleId(bundleId: number | string, queryable?: Queryable): Promise<void>;
  createBundleItems(
    bundleId: number | string,
    items: BundleItemDTO[],
    queryable?: Queryable
  ): Promise<void>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class BundlesRepository implements IBundlesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: BundleFilters,
    queryable?: Queryable
  ): Promise<{ rows: BundleRecord[]; total: number }> {
    const { status, page, pageSize, sortBy, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = sortBy === 'name' ? 'b.name' : 'b.created_at';
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (status) {
      params.push(status);
      where += ` AND b.status = $${params.length}`;
    }

    const countResult = await this.q(queryable).query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM product_bundles b ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    // `b.bundle_price AS price`, not `b.price`: the writer has always written
    // `bundle_price` while this projection read the `price` column nothing writes, so
    // every row came back priced at its column default of 0 (#124).
    const bundles = await this.q(queryable).query<BundleRecord>(
      `SELECT b.id, b.name, b.description, b.bundle_price AS price, b.status, b.created_at, b.updated_at,
              COUNT(bi.id)::int as item_count,
              COALESCE(SUM(p.price * bi.quantity), 0) as original_price
       FROM product_bundles b
       LEFT JOIN bundle_items bi ON bi.bundle_id = b.id
       LEFT JOIN products p ON bi.product_id = p.id
       ${where}
       GROUP BY b.id, b.name, b.description, b.bundle_price, b.status, b.created_at, b.updated_at
       ORDER BY ${sortColumn} ${direction}, b.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, offset]
    );

    // The items belong to the list response, not just the detail one: the POS reads
    // this endpoint and prices a bundle tile from them, and the Bundles page counts
    // them. One extra query for the page rather than a per-row N+1.
    const ids = bundles.rows.map((b) => b.id);
    const items = ids.length > 0 ? await this.findItemsByBundleIds(ids, queryable) : [];
    const itemsByBundle = new Map<number, BundleItemRecord[]>();
    for (const item of items) {
      const list = itemsByBundle.get(item.bundle_id) ?? [];
      list.push(item);
      itemsByBundle.set(item.bundle_id, list);
    }

    return {
      rows: bundles.rows.map((row) =>
        withSavings({ ...row, items: itemsByBundle.get(row.id) ?? [] })
      ),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<BundleRecord | null> {
    // Named columns rather than `SELECT *`, so the dead `price` column cannot ride along
    // beside the aliased one and hand a consumer two answers for the same question.
    const res = await this.q(queryable).query<BundleRecord>(
      `SELECT id, name, description, bundle_price AS price, status, starts_at, expires_at,
              created_at, updated_at
       FROM product_bundles WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findItemsByBundleId(
    bundleId: number | string,
    queryable?: Queryable
  ): Promise<BundleItemRecord[]> {
    const res = await this.q(queryable).query<BundleItemRecord>(
      `SELECT bi.*, p.name as product_name, p.sku, p.price as product_price, p.stock, p.image_url
       FROM bundle_items bi
       JOIN products p ON bi.product_id = p.id
       WHERE bi.bundle_id = $1`,
      [bundleId]
    );
    return res.rows;
  }

  async findItemsByBundleIds(
    bundleIds: number[],
    queryable?: Queryable
  ): Promise<BundleItemRecord[]> {
    const res = await this.q(queryable).query<BundleItemRecord>(
      `SELECT bi.*, p.name as product_name, p.sku, p.price as product_price, p.stock, p.image_url
       FROM bundle_items bi
       JOIN products p ON bi.product_id = p.id
       WHERE bi.bundle_id = ANY($1::int[])`,
      [bundleIds]
    );
    return res.rows;
  }

  async create(data: CreateBundleDTO, queryable?: Queryable): Promise<BundleRecord> {
    const res = await this.q(queryable).query<BundleRecord>(
      `INSERT INTO product_bundles (name, description, bundle_price, starts_at, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, bundle_price AS price, status, starts_at, expires_at,
                 created_at, updated_at`,
      [
        data.name,
        data.description || null,
        data.price,
        data.starts_at || null,
        data.expires_at || null,
        data.status ?? 'active',
      ]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateBundleDTO,
    queryable?: Queryable
  ): Promise<BundleRecord | null> {
    const res = await this.q(queryable).query<BundleRecord>(
      `UPDATE product_bundles
          SET name = $1, description = $2, bundle_price = $3, starts_at = $4, expires_at = $5,
              status = COALESCE($6, status), updated_at = NOW()
        WHERE id = $7
       RETURNING id, name, description, bundle_price AS price, status, starts_at, expires_at,
                 created_at, updated_at`,
      [
        data.name,
        data.description || null,
        data.price,
        data.starts_at || null,
        data.expires_at || null,
        data.status ?? null,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async deleteItemsByBundleId(bundleId: number | string, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query('DELETE FROM bundle_items WHERE bundle_id = $1', [bundleId]);
  }

  async createBundleItems(
    bundleId: number | string,
    items: BundleItemDTO[],
    queryable?: Queryable
  ): Promise<void> {
    for (const item of items) {
      await this.q(queryable).query(
        `INSERT INTO bundle_items (bundle_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [bundleId, item.product_id, item.quantity ?? 1]
      );
    }
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM product_bundles WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }
}

export const bundlesRepository = new BundlesRepository();
