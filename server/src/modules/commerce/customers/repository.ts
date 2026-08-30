import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { CustomerFilters, CustomerStats } from './types';

export interface ICustomersRepository {
  list(
    filters: CustomerFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  create(data: Record<string, any>, queryable?: Queryable): Promise<Record<string, any>>;
  update(
    id: number | string,
    data: Record<string, any>,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
  getStats(id: number | string, queryable?: Queryable): Promise<CustomerStats>;
  getSales(
    id: number | string,
    page: number,
    limit: number,
    sortOrder: 'asc' | 'desc',
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }>;
  getLoyaltyHistory(id: number | string, queryable?: Queryable): Promise<Record<string, any>[]>;
  adjustLoyalty(id: number, points: number, note: string, queryable: Queryable): Promise<number>;
}

export class CustomersRepository implements ICustomersRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: CustomerFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }> {
    const { search, page, pageSize, sortBy, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = sortBy === 'createdAt' ? 'created_at' : 'name';
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: unknown[] = [];

    if (search) {
      where.push(`(name ILIKE $${params.length + 1} OR phone ILIKE $${params.length + 2})`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*)::int as count FROM customers ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const rowsRes = await this.q(queryable).query(
      `SELECT * FROM customers ${whereClause} ORDER BY ${sortColumn} ${direction}, id ${direction} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, offset]
    );

    return { rows: rowsRes.rows, total };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM customers WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async create(data: Record<string, any>, queryable?: Queryable): Promise<Record<string, any>> {
    const res = await this.q(queryable).query(
      'INSERT INTO customers (name, phone, address, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.name, data.phone, data.address || null, data.notes || null]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: Record<string, any>,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      'UPDATE customers SET name = $1, phone = $2, address = $3, notes = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [data.name, data.phone, data.address || null, data.notes || null, id]
    );
    return res.rows[0] || null;
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query('DELETE FROM customers WHERE id = $1 RETURNING id', [
      id,
    ]);
    return res.rows.length > 0;
  }

  async getStats(id: number | string, queryable?: Queryable): Promise<CustomerStats> {
    const stats = await this.q(queryable).query<{
      total_spent: string | number;
      order_count: number;
      avg_order: string | number;
      last_purchase: string | null;
    }>(
      `SELECT
        COALESCE(SUM(total), 0) as total_spent,
        COUNT(*)::int as order_count,
        COALESCE(AVG(total), 0) as avg_order,
        MAX(created_at) as last_purchase
       FROM sales WHERE customer_id = $1`,
      [id]
    );
    const row = stats.rows[0];
    return {
      total_spent: Number(row?.total_spent || 0),
      order_count: Number(row?.order_count || 0),
      avg_order: Number(row?.avg_order || 0),
      last_purchase: row?.last_purchase || null,
    };
  }

  async getSales(
    id: number | string,
    page: number,
    pageSize: number,
    sortOrder: 'asc' | 'desc',
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const countRes = await this.q(queryable).query<{ count: string | number }>(
      'SELECT COUNT(*)::int as count FROM sales WHERE customer_id = $1',
      [id]
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const rowsRes = await this.q(queryable).query(
      `SELECT s.id, s.customer_id, s.cashier_id, s.subtotal, s.discount, s.tax, s.total,
              s.payment_method, s.receipt_number, s.status, s.notes, s.created_at, s.updated_at,
              u.name as cashier_name,
              COUNT(si.id)::int as items_count
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.customer_id = $1
       GROUP BY s.id, s.customer_id, s.cashier_id, s.subtotal, s.discount, s.tax, s.total,
                s.payment_method, s.receipt_number, s.status, s.notes, s.created_at, s.updated_at, u.name
       ORDER BY s.created_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'}, s.id ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
       LIMIT $2 OFFSET $3`,
      [id, pageSize, offset]
    );

    return { rows: rowsRes.rows, total };
  }

  async getLoyaltyHistory(
    id: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT lt.*, s.total as sale_total
       FROM loyalty_transactions lt
       LEFT JOIN sales s ON lt.sale_id = s.id
       WHERE lt.customer_id = $1
       ORDER BY lt.created_at DESC
       LIMIT 100`,
      [id]
    );
    return res.rows;
  }

  async adjustLoyalty(
    id: number,
    points: number,
    note: string,
    queryable: Queryable
  ): Promise<number> {
    const res = await queryable.query<{ loyalty_points: number }>(
      `UPDATE customers SET loyalty_points = GREATEST(0, loyalty_points + $1), updated_at = NOW() WHERE id = $2 RETURNING loyalty_points`,
      [points, id]
    );

    if (res.rows.length === 0) {
      throw new Error('Customer not found');
    }

    await queryable.query(
      `INSERT INTO loyalty_transactions (customer_id, points, type, note) VALUES ($1, $2, $3, $4)`,
      [id, points, 'adjustment', note]
    );

    return res.rows[0].loyalty_points;
  }
}

export const customersRepository = new CustomersRepository();
