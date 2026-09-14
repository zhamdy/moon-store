import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { buildPartialUpdate, orNull } from '../../../database/partialUpdate';
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
      `SELECT c.id, c.name, c.code, c.slug, c.name_en, c.description_en, c.created_at, c.updated_at,
              COUNT(CASE WHEN p.status = 'active' THEN p.id END)::int as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id, c.name, c.code, c.slug, c.name_en, c.description_en, c.created_at, c.updated_at
       ORDER BY c.name`
    );
    return res.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<CategoryRecord | null> {
    const res = await this.q(queryable).query<CategoryRecord>(
      `SELECT c.id, c.name, c.code, c.slug, c.name_en, c.description_en, c.created_at, c.updated_at,
              COUNT(CASE WHEN p.status = 'active' THEN p.id END)::int as product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       WHERE c.id = $1
       GROUP BY c.id, c.name, c.code, c.slug, c.name_en, c.description_en, c.created_at, c.updated_at`,
      [id]
    );
    return res.rows[0] || null;
  }

  async create(data: CreateCategoryDTO, queryable?: Queryable): Promise<CategoryRecord> {
    const res = await this.q(queryable).query<CategoryRecord>(
      `INSERT INTO categories (name, code, slug, name_en, description_en)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.code, data.slug ?? null, data.name_en || null, data.description_en || null]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateCategoryDTO,
    queryable?: Queryable
  ): Promise<CategoryRecord | null> {
    // name and code are replaced; the storefront fields only when the body names them.
    const { setClause, params, nextIndex } = buildPartialUpdate({
      name: data.name,
      code: data.code,
      slug: data.slug,
      name_en: orNull(data.name_en),
      description_en: orNull(data.description_en),
    });
    const res = await this.q(queryable).query<CategoryRecord>(
      `UPDATE categories SET ${setClause} WHERE id = $${nextIndex} RETURNING *`,
      [...params, id]
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
    const res = await this.q(queryable).query('DELETE FROM categories WHERE id = $1 RETURNING id', [
      id,
    ]);
    return res.rows.length > 0;
  }
}

export const categoriesRepository = new CategoriesRepository();
