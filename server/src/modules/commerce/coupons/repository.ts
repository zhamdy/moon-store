import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { buildPartialUpdate } from '../../../database/partialUpdate';
import { CouponData, CouponFilters, CouponListResult, UpdateCouponData } from './types';

export interface ICouponsRepository {
  list(filters: CouponFilters, queryable?: Queryable): Promise<CouponListResult>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findByCodeForUpdate(code: string, queryable: Queryable): Promise<Record<string, any> | null>;
  create(data: CouponData, queryable?: Queryable): Promise<Record<string, any>>;
  update(
    id: string | number,
    data: UpdateCouponData,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  delete(id: string | number, queryable?: Queryable): Promise<boolean>;
  getUsageCount(couponId: number, queryable?: Queryable): Promise<number>;
  getCustomerUsageCount(
    couponId: number,
    customerId: number,
    queryable?: Queryable
  ): Promise<number>;
  checkProductCategoriesMatch(
    itemProductIds: number[],
    categoryIds: number[],
    queryable?: Queryable
  ): Promise<number>;
}

export class CouponsRepository implements ICouponsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  private parseScopeIds(row: Record<string, any>): Record<string, any> {
    return {
      ...row,
      scope_ids: row.scope_ids
        ? typeof row.scope_ids === 'string'
          ? JSON.parse(row.scope_ids)
          : row.scope_ids
        : null,
    };
  }

  private buildCouponParams(data: CouponData): unknown[] {
    return [
      data.code,
      data.type,
      data.value,
      data.min_purchase ?? null,
      data.max_discount ?? null,
      data.starts_at ?? null,
      data.expires_at ?? null,
      data.max_uses ?? null,
      data.max_uses_per_customer ?? null,
      data.scope,
      data.scope_ids ? JSON.stringify(data.scope_ids) : null,
      data.stackable ? 1 : 0,
    ];
  }

  async list(filters: CouponFilters, queryable?: Queryable): Promise<CouponListResult> {
    const direction = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = filters.sortBy === 'code' ? 'c.code' : 'c.created_at';
    const pageNum = filters.page;
    const limitNum = filters.pageSize;
    const offset = (pageNum - 1) * limitNum;

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.search) {
      where.push(`c.code ILIKE $${paramIdx++}`);
      params.push(`%${filters.search}%`);
    }
    if (filters.status) {
      where.push(`c.status = $${paramIdx++}`);
      params.push(filters.status);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM coupons c ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const queryParams = [...params, limitNum, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const result = await this.q(queryable).query(
      `SELECT c.*, COALESCE(cu_agg.usage_count, 0)::int as usage_count
       FROM coupons c
       LEFT JOIN (
         SELECT coupon_id, COUNT(*) as usage_count FROM coupon_usage GROUP BY coupon_id
       ) cu_agg ON cu_agg.coupon_id = c.id
       ${whereClause}
       ORDER BY ${sortColumn} ${direction}, c.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    const coupons = result.rows.map((row: any) => this.parseScopeIds(row));
    return { coupons, total, page: pageNum };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM coupons WHERE id = $1', [id]);
    return res.rows[0] ? this.parseScopeIds(res.rows[0]) : null;
  }

  async findByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `SELECT * FROM coupons WHERE code = $1 AND status = 'active'`,
      [code.toUpperCase().trim()]
    );
    return res.rows[0] ? this.parseScopeIds(res.rows[0]) : null;
  }

  /**
   * `findByCode` that also takes a row lock on the coupon.
   *
   * `max_uses` counts rows in `coupon_usage`, so the invariant spans rows and cannot be
   * expressed as one conditional write the way a stock decrement can. Locking the parent
   * coupon row serializes everyone counting against the same limit. Consuming path only:
   * a preview that took this lock would block live checkouts for no benefit.
   */
  async findByCodeForUpdate(
    code: string,
    queryable: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await queryable.query(
      `SELECT * FROM coupons WHERE code = $1 AND status = 'active' FOR UPDATE`,
      [code.toUpperCase().trim()]
    );
    return res.rows[0] ? this.parseScopeIds(res.rows[0]) : null;
  }

  async create(data: CouponData, queryable?: Queryable): Promise<Record<string, any>> {
    const result = await this.q(queryable).query(
      `INSERT INTO coupons (code, type, value, min_purchase, max_discount, starts_at, expires_at, max_uses, max_uses_per_customer, scope, scope_ids, stackable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      this.buildCouponParams(data)
    );
    return this.parseScopeIds(result.rows[0]);
  }

  /**
   * Merges a partial update onto the stored row — see `buildPartialUpdate` for the rule.
   *
   * This used to write all twelve columns from an all-optional body, so a field the client
   * did not send was written back as NULL (or as the schema's default). The Promotions form
   * has no input for `max_uses_per_customer` or `scope_ids`, so every edit dropped a
   * per-customer limit and widened a category-scoped coupon to everything.
   *
   * `scope_ids` is the one column whose SQL value is not its DTO value: it is stored as
   * JSON text. `null` still means "clear it"; only `undefined` skips the column.
   */
  async update(
    id: string | number,
    data: UpdateCouponData,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const { setClause, params, nextIndex } = buildPartialUpdate({
      code: data.code,
      type: data.type,
      value: data.value,
      min_purchase: data.min_purchase,
      max_discount: data.max_discount,
      starts_at: data.starts_at,
      expires_at: data.expires_at,
      max_uses: data.max_uses,
      max_uses_per_customer: data.max_uses_per_customer,
      scope: data.scope,
      scope_ids:
        data.scope_ids === undefined ? undefined : data.scope_ids && JSON.stringify(data.scope_ids),
      stackable: data.stackable === undefined ? undefined : data.stackable ? 1 : 0,
    });

    const result = await this.q(queryable).query(
      `UPDATE coupons SET ${setClause} WHERE id=$${nextIndex} AND status='active' RETURNING *`,
      [...params, id]
    );
    return result.rows[0] ? this.parseScopeIds(result.rows[0]) : null;
  }

  async delete(id: string | number, queryable?: Queryable): Promise<boolean> {
    const result = await this.q(queryable).query(
      `UPDATE coupons SET status='inactive', updated_at=NOW() WHERE id=$1 RETURNING id`,
      [id]
    );
    return result.rows.length > 0;
  }

  async getUsageCount(couponId: number, queryable?: Queryable): Promise<number> {
    const usageResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = $1`,
      [couponId]
    );
    return Number(usageResult.rows[0]?.count || 0);
  }

  async getCustomerUsageCount(
    couponId: number,
    customerId: number,
    queryable?: Queryable
  ): Promise<number> {
    const customerUsageResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = $1 AND customer_id = $2`,
      [couponId, customerId]
    );
    return Number(customerUsageResult.rows[0]?.count || 0);
  }

  async checkProductCategoriesMatch(
    itemProductIds: number[],
    categoryIds: number[],
    queryable?: Queryable
  ): Promise<number> {
    const placeholders = itemProductIds.map((_, i) => `$${i + 1}`).join(',');
    const catPlaceholders = categoryIds
      .map((_, i) => `$${i + 1 + itemProductIds.length}`)
      .join(',');
    const matchResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM products
       WHERE id IN (${placeholders}) AND category_id IN (${catPlaceholders})`,
      [...itemProductIds, ...categoryIds]
    );
    return Number(matchResult.rows[0]?.count || 0);
  }
}

export const couponsRepository = new CouponsRepository();
