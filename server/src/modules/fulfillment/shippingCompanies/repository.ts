import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { CreateShippingCompanyDTO, UpdateShippingCompanyDTO } from './types';

export interface IShippingCompaniesRepository {
  list(queryable?: Queryable): Promise<Record<string, any>[]>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  create(data: CreateShippingCompanyDTO, queryable?: Queryable): Promise<Record<string, any>>;
  update(
    id: number | string,
    data: UpdateShippingCompanyDTO,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class ShippingCompaniesRepository implements IShippingCompaniesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(queryable?: Queryable): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT sc.id, sc.name, sc.phone, sc.email, sc.tracking_url_template, sc.is_active, sc.created_at, sc.updated_at,
              COUNT(del_o.id)::int as order_count
       FROM shipping_companies sc
       LEFT JOIN delivery_orders del_o ON del_o.shipping_company_id = sc.id
       GROUP BY sc.id, sc.name, sc.phone, sc.email, sc.tracking_url_template, sc.is_active, sc.created_at, sc.updated_at
       ORDER BY sc.is_active DESC, sc.name ASC`
    );
    return res.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM shipping_companies WHERE id = $1', [
      id,
    ]);
    return res.rows[0] || null;
  }

  async create(
    data: CreateShippingCompanyDTO,
    queryable?: Queryable
  ): Promise<Record<string, any>> {
    const res = await this.q(queryable).query(
      `INSERT INTO shipping_companies (name, phone, email, tracking_url_template, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.name,
        data.phone || null,
        data.email || null,
        data.tracking_url_template || null,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      ]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateShippingCompanyDTO,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `UPDATE shipping_companies SET name = $1, phone = $2, email = $3, tracking_url_template = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        data.name,
        data.phone || null,
        data.email || null,
        data.tracking_url_template || null,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM shipping_companies WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }
}

export const shippingCompaniesRepository = new ShippingCompaniesRepository();
