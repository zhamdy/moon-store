import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  CreateWarrantyClaimDTO,
  UpdateWarrantyClaimDTO,
  WarrantyClaimRecord,
  WarrantyFilters,
} from './types';

export interface IWarrantyRepository {
  list(
    filters: WarrantyFilters,
    queryable?: Queryable
  ): Promise<{ rows: WarrantyClaimRecord[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<WarrantyClaimRecord | null>;
  create(data: CreateWarrantyClaimDTO, queryable?: Queryable): Promise<WarrantyClaimRecord>;
  update(
    id: number | string,
    data: UpdateWarrantyClaimDTO,
    queryable?: Queryable
  ): Promise<WarrantyClaimRecord | null>;
}

export class WarrantyRepository implements IWarrantyRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: WarrantyFilters,
    queryable?: Queryable
  ): Promise<{ rows: WarrantyClaimRecord[]; total: number }> {
    const { status, page: pageNum, pageSize: limitNum } = filters;
    const offset = (pageNum - 1) * limitNum;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (status && status !== 'all') {
      params.push(status);
      where += ` AND w.status = $${params.length}`;
    }

    const countResult = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COUNT(*)::int as total FROM warranty_claims w ${where}`,
      params
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const claims = await this.q(queryable).query<WarrantyClaimRecord>(
      `SELECT w.*, p.name as product_name, p.sku as product_sku
       FROM warranty_claims w
       JOIN products p ON w.product_id = p.id
       ${where}
       ORDER BY w.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limitNum, offset]
    );

    return { rows: claims.rows, total };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<WarrantyClaimRecord | null> {
    const res = await this.q(queryable).query<WarrantyClaimRecord>(
      `SELECT w.*, p.name as product_name, p.sku as product_sku
       FROM warranty_claims w
       JOIN products p ON w.product_id = p.id
       WHERE w.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(data: CreateWarrantyClaimDTO, queryable?: Queryable): Promise<WarrantyClaimRecord> {
    const result = await this.q(queryable).query<WarrantyClaimRecord>(
      `INSERT INTO warranty_claims (sale_id, product_id, customer_id, customer_name, customer_phone, issue_description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [
        data.sale_id || null,
        data.product_id,
        data.customer_id || null,
        data.customer_name,
        data.customer_phone,
        data.issue_description,
      ]
    );
    return result.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateWarrantyClaimDTO,
    queryable?: Queryable
  ): Promise<WarrantyClaimRecord | null> {
    const result = await this.q(queryable).query<WarrantyClaimRecord>(
      `UPDATE warranty_claims SET status = COALESCE($1, status), resolution = COALESCE($2, resolution),
              resolved_at = CASE WHEN $1 IN ('resolved', 'replaced', 'refunded') THEN NOW() ELSE resolved_at END,
              updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [data.status || null, data.resolution || null, id]
    );
    return result.rows[0] || null;
  }
}

export const warrantyRepository = new WarrantyRepository();
