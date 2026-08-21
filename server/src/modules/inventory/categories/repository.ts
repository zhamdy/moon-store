import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { CategoryRecord, CreateCategoryDTO, UpdateCategoryDTO } from './types';

export interface ICategoriesRepository {
  findAll(queryable?: Queryable): Promise<CategoryRecord[]>;
  findById(id: number | string, queryable?: Queryable): Promise<CategoryRecord | null>;
  create(data: CreateCategoryDTO, queryable?: Queryable): Promise<CategoryRecord>;
  update(
    id: number | string,
    data: UpdateCategoryDTO,
    queryable?: Queryable
  ): Promise<CategoryRecord | null>;
  countProducts(id: number | string, queryable?: Queryable): Promise<number>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class CategoriesRepository implements ICategoriesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findAll(queryable?: Queryable): Promise<CategoryRecord[]> {
    const res = await this.q(queryable).query<CategoryRecord>(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.status = 'active') as product_count
       FROM categories c
       ORDER BY c.name`
    );
    return res.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<CategoryRecord | null> {
    const res = await this.q(queryable).query<CategoryRecord>(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.status = 'active') as product_count
       FROM categories c
       WHERE c.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(data: CreateCategoryDTO, queryable?: Queryable): Promise<CategoryRecord> {
    const res = await this.q(queryable).query<CategoryRecord>(
      `INSERT INTO categories (name, code) VALUES ($1, $2) RETURNING *`,
      [data.name, data.code]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateCategoryDTO,
    queryable?: Queryable
  ): Promise<CategoryRecord | null> {
    const res = await this.q(queryable).query<CategoryRecord>(
      `UPDATE categories SET name = $1, code = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [data.name, data.code, id]
    );
    return res.rows[0] || null;
  }

  async countProducts(id: number | string, queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query<{ count: string | number }>(
      'SELECT COUNT(*)::int as count FROM products WHERE category_id = $1',
      [id]
    );
    return Number(res.rows[0]?.count || 0);
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM categories WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }
}

export const categoriesRepository = new CategoriesRepository();
