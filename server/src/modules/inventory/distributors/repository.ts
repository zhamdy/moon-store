import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { DistributorRecord, CreateDistributorDTO, UpdateDistributorDTO } from './types';

export interface IDistributorsRepository {
  findAll(queryable?: Queryable): Promise<DistributorRecord[]>;
  findById(id: number | string, queryable?: Queryable): Promise<DistributorRecord | null>;
  create(data: CreateDistributorDTO, queryable?: Queryable): Promise<DistributorRecord>;
  update(
    id: number | string,
    data: UpdateDistributorDTO,
    queryable?: Queryable
  ): Promise<DistributorRecord | null>;
  countProducts(id: number | string, queryable?: Queryable): Promise<number>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class DistributorsRepository implements IDistributorsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findAll(queryable?: Queryable): Promise<DistributorRecord[]> {
    const res = await this.q(queryable).query<DistributorRecord>(
      `SELECT d.*,
              (SELECT COUNT(*)::int FROM products p WHERE p.distributor_id = d.id AND p.status = 'active') as product_count
       FROM distributors d
       ORDER BY d.name`
    );
    return res.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<DistributorRecord | null> {
    const res = await this.q(queryable).query<DistributorRecord>(
      `SELECT d.*,
              (SELECT COUNT(*)::int FROM products p WHERE p.distributor_id = d.id AND p.status = 'active') as product_count
       FROM distributors d
       WHERE d.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(data: CreateDistributorDTO, queryable?: Queryable): Promise<DistributorRecord> {
    const res = await this.q(queryable).query<DistributorRecord>(
      `INSERT INTO distributors (name, contact_info, phone, email, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.name,
        data.contact_person || null,
        data.phone || null,
        data.email || null,
        data.address || null,
        data.notes || null,
      ]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateDistributorDTO,
    queryable?: Queryable
  ): Promise<DistributorRecord | null> {
    const res = await this.q(queryable).query<DistributorRecord>(
      `UPDATE distributors SET name = $1, contact_info = $2, phone = $3, email = $4, address = $5, notes = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        data.name,
        data.contact_person || null,
        data.phone || null,
        data.email || null,
        data.address || null,
        data.notes || null,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async countProducts(id: number | string, queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query<{ count: string | number }>(
      'SELECT COUNT(*)::int as count FROM products WHERE distributor_id = $1',
      [id]
    );
    return Number(res.rows[0]?.count || 0);
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM distributors WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }
}

export const distributorsRepository = new DistributorsRepository();
