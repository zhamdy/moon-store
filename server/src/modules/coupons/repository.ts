import { Queryable } from '../../database/transaction';
import pool from '../../database/pool';
import { CouponFilters, CreateCouponDTO } from './types';

export interface ICouponsRepository {
  list(
    filters: CouponFilters,
    queryable?: Queryable
  ): Promise<{ coupons: Record<string, any>[]; total: number }>;
  findByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  create(data: CreateCouponDTO, queryable?: Queryable): Promise<Record<string, any>>;
  update(
    id: number | string,
    data: CreateCouponDTO,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  deactivate(id: number | string, queryable?: Queryable): Promise<boolean>;
  getUsageCount(couponId: number, queryable?: Queryable): Promise<number>;
  getCustomerUsageCount(
    couponId: number,
    customerId: number,
    queryable?: Queryable
  ): Promise<number>;
  checkCategoryProductMatch(
    itemProductIds: number[],
    categoryIds: number[],
    queryable?: Queryable
  ): Promise<boolean>;
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

  async list(
    filters: CouponFilters,
    queryable?: Queryable
  ): Promise<{ coupons: Record<string, any>[]; total: number }> {
    const { page = 1, limit = 25, search, status } = filters;
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      where.push(`c.code ILIKE $${paramIdx++}`);
      params.push(`%${search}%`);
    }
    if (status) {
      where.push(`c.status = $${paramIdx++}`);
      params.push(status);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM coupons c ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const queryParams = [...params, limit, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const res = await this.q(queryable).query(
      `SELECT c.*, COALESCE(cu_agg.usage_count, 0)::int as usage_count
       FROM coupons c
       LEFT JOIN (
         SELECT coupon_id, COUNT(*) as usage_count FROM coupon_usage GROUP BY coupon_id
       ) cu_agg ON cu_agg.coupon_id = c.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return { coupons: res.rows.map((r) => this.parseScopeIds(r)), total };
  }

  async findByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      "SELECT * FROM coupons WHERE code = $1 AND status = 'active'",
      [code.toUpperCase().trim()]
    );
    return res.rows[0] ? this.parseScopeIds(res.rows[0]) : null;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM coupons WHERE id = $1', [id]);
    return res.rows[0] ? this.parseScopeIds(res.rows[0]) : null;
  }

  async create(data: CreateCouponDTO, queryable?: Queryable): Promise<Record<string, any>> {
    const res = await this.q(queryable).query(
      `INSERT INTO coupons (code, type, value, min_purchase, max_discount, starts_at, expires_at, max_uses, max_uses_per_customer, scope, scope_ids, stackable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
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
      ]
    );
    return this.parseScopeIds(res.rows[0]);
  }

  async update(
    id: number | string,
    data: CreateCouponDTO,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `UPDATE coupons SET code=$1, type=$2, value=$3, min_purchase=$4, max_discount=$5, starts_at=$6, expires_at=$7, max_uses=$8, max_uses_per_customer=$9, scope=$10, scope_ids=$11, stackable=$12, updated_at=NOW()
       WHERE id=$13 AND status='active' RETURNING *`,
      [
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
        id,
      ]
    );
    return res.rows[0] ? this.parseScopeIds(res.rows[0]) : null;
  }

  async deactivate(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      "UPDATE coupons SET status='inactive', updated_at=NOW() WHERE id=$1 RETURNING id",
      [id]
    );
    return res.rows.length > 0;
  }

  async getUsageCount(couponId: number, queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query<{ count: string | number }>(
      'SELECT COUNT(*)::int as count FROM coupon_usage WHERE coupon_id = $1',
      [couponId]
    );
    return Number(res.rows[0]?.count || 0);
  }

  async getCustomerUsageCount(
    couponId: number,
    customerId: number,
    queryable?: Queryable
  ): Promise<number> {
    const res = await this.q(queryable).query<{ count: string | number }>(
      'SELECT COUNT(*)::int as count FROM coupon_usage WHERE coupon_id = $1 AND customer_id = $2',
      [couponId, customerId]
    );
    return Number(res.rows[0]?.count || 0);
  }

  async checkCategoryProductMatch(
    itemProductIds: number[],
    categoryIds: number[],
    queryable?: Queryable
  ): Promise<boolean> {
    if (itemProductIds.length === 0 || categoryIds.length === 0) return false;
    const placeholders = itemProductIds.map((_, i) => `$${i + 1}`).join(',');
    const catPlaceholders = categoryIds
      .map((_, i) => `$${i + 1 + itemProductIds.length}`)
      .join(',');
    const res = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*)::int as count FROM products WHERE id IN (${placeholders}) AND category_id IN (${catPlaceholders})`,
      [...itemProductIds, ...categoryIds]
    );
    return Number(res.rows[0]?.count || 0) > 0;
  }
}

export const couponsRepository = new CouponsRepository();
