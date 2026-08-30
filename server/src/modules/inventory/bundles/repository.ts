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

    const bundles = await this.q(queryable).query<BundleRecord>(
      `SELECT b.id, b.name, b.description, b.price, b.discount_type, b.discount_value, b.status, b.created_at, b.updated_at,
              COUNT(bi.id)::int as item_count,
              COALESCE(SUM(p.price * bi.quantity), 0) as original_price
       FROM product_bundles b
       LEFT JOIN bundle_items bi ON bi.bundle_id = b.id
       LEFT JOIN products p ON bi.product_id = p.id
       ${where}
       GROUP BY b.id, b.name, b.description, b.price, b.discount_type, b.discount_value, b.status, b.created_at, b.updated_at
       ORDER BY ${sortColumn} ${direction}, b.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, offset]
    );

    return {
      rows: bundles.rows,
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<BundleRecord | null> {
    const res = await this.q(queryable).query<BundleRecord>(
      'SELECT * FROM product_bundles WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async findItemsByBundleId(
    bundleId: number | string,
    queryable?: Queryable
  ): Promise<BundleItemRecord[]> {
    const res = await this.q(queryable).query<BundleItemRecord>(
      `SELECT bi.*, p.name as product_name, p.sku, p.price as original_price, p.stock, p.image_url
       FROM bundle_items bi
       JOIN products p ON bi.product_id = p.id
       WHERE bi.bundle_id = $1`,
      [bundleId]
    );
    return res.rows;
  }

  async create(data: CreateBundleDTO, queryable?: Queryable): Promise<BundleRecord> {
    const res = await this.q(queryable).query<BundleRecord>(
      `INSERT INTO product_bundles (name, description, bundle_price, starts_at, expires_at, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
      [
        data.name,
        data.description || null,
        data.bundle_price,
        data.starts_at || null,
        data.expires_at || null,
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
      `UPDATE product_bundles SET name = $1, description = $2, bundle_price = $3, starts_at = $4, expires_at = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        data.name,
        data.description || null,
        data.bundle_price,
        data.starts_at || null,
        data.expires_at || null,
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
