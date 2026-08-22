import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { ProductFilters } from './types';

export interface IProductsRepository {
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findByBarcode(barcode: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findVariantByBarcode(barcode: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  list(
    filters: ProductFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }>;
  lookup(
    ids: number[],
    includeInactive: boolean,
    queryable?: Queryable
  ): Promise<Record<string, any>[]>;
  create(data: Record<string, any>, queryable?: Queryable): Promise<Record<string, any>>;
  update(
    id: number | string,
    data: Record<string, any>,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  updateImage(id: number | string, imageUrl: string | null, queryable?: Queryable): Promise<void>;
  createPriceHistory(
    productId: number | string,
    field: string,
    oldValue: number,
    newValue: number,
    userId: number,
    queryable?: Queryable
  ): Promise<void>;
  listCategories(queryable?: Queryable): Promise<Record<string, any>[]>;
  listLowStock(queryable?: Queryable): Promise<Record<string, any>[]>;
  findVariantsByProductId(
    productId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]>;
  getStockAdjustments(
    productId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]>;
  getPriceHistory(
    productId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]>;
}

export class ProductsRepository implements IProductsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN distributors d ON p.distributor_id = d.id
       WHERE p.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findByBarcode(barcode: string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      "SELECT * FROM products WHERE barcode = $1 AND status = 'active'",
      [barcode]
    );
    return res.rows[0] || null;
  }

  async findVariantByBarcode(
    barcode: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `SELECT v.*, p.name as product_name, p.category, p.category_id, p.image_url, p.has_variants
       FROM product_variants v
       JOIN products p ON v.product_id = p.id
       WHERE v.barcode = $1 AND p.status = 'active'`,
      [barcode]
    );
    return res.rows[0] || null;
  }

  async list(
    filters: ProductFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }> {
    const {
      search,
      categoryId,
      status,
      lowStock,
      page = 1,
      pageSize = 25,
      sortBy = 'name',
      sortOrder = 'asc',
    } = filters;

    const offset = (page - 1) * pageSize;
    const sortColumns = {
      name: 'p.name',
      price: 'p.price',
      stock: 'p.stock',
      category: 'p.category',
      createdAt: 'p.created_at',
    } as const;
    const sortCol = sortColumns[sortBy];
    const sqlSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      where.push(
        `(p.name ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx} OR p.barcode ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (categoryId) {
      where.push(`p.category_id = $${paramIdx++}`);
      params.push(categoryId);
    }

    if (status && status !== 'all') {
      where.push(`p.status = $${paramIdx++}`);
      params.push(status);
    } else if (!status) {
      where.push(`p.status = 'active'`);
    }
    if (lowStock) where.push('p.stock <= p.min_stock');

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM products p ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const queryParams = [...params, pageSize, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const rowsRes = await this.q(queryable).query(
      `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name,
              COALESCE(va.variant_count, 0)::int as variant_count,
              COALESCE(va.variant_stock, 0)::int as variant_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN distributors d ON p.distributor_id = d.id
       LEFT JOIN (SELECT product_id, COUNT(*)::int variant_count, COALESCE(SUM(stock), 0)::int variant_stock
                  FROM product_variants GROUP BY product_id) va ON va.product_id = p.id
       ${whereClause}
       ORDER BY ${sortCol} ${sqlSortOrder}, p.id ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return { rows: rowsRes.rows, total };
  }

  async lookup(
    ids: number[],
    includeInactive: boolean,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const visibility = includeInactive ? '' : "AND p.status = 'active'";
    const result = await this.q(queryable).query(
      `SELECT p.id, p.name, p.sku, p.barcode, p.price, p.stock, p.status,
              p.category_id, p.image_url
       FROM products p
       WHERE p.id = ANY($1::int[]) ${visibility}
       ORDER BY p.id ASC`,
      [ids]
    );
    return result.rows;
  }

  async create(data: Record<string, any>, queryable?: Queryable): Promise<Record<string, any>> {
    const res = await this.q(queryable).query(
      `INSERT INTO products (name, sku, barcode, price, cost_price, stock, category, category_id, distributor_id, min_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.name,
        data.sku,
        data.barcode || null,
        data.price,
        data.cost_price,
        data.stock,
        data.category || null,
        data.category_id || null,
        data.distributor_id || null,
        data.min_stock,
      ]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: Record<string, any>,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `UPDATE products SET name=$1, sku=$2, barcode=$3, price=$4, cost_price=$5, stock=$6, category=$7, category_id=$8, distributor_id=$9, min_stock=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [
        data.name,
        data.sku,
        data.barcode || null,
        data.price,
        data.cost_price,
        data.stock,
        data.category || null,
        data.category_id || null,
        data.distributor_id || null,
        data.min_stock,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0] || null;
  }

  async updateImage(
    id: number | string,
    imageUrl: string | null,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2',
      [imageUrl, id]
    );
  }

  async createPriceHistory(
    productId: number | string,
    field: string,
    oldValue: number,
    newValue: number,
    userId: number,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      'INSERT INTO price_history (product_id, field, old_value, new_value, user_id) VALUES ($1, $2, $3, $4, $5)',
      [productId, field, oldValue, newValue, userId]
    );
  }

  async listCategories(queryable?: Queryable): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      'SELECT id, name, code FROM categories ORDER BY name'
    );
    return res.rows;
  }

  async listLowStock(queryable?: Queryable): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT p.*, c.name as category_name, c.code as category_code, d.name as distributor_name,
              (p.min_stock - p.stock) as deficit
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN distributors d ON p.distributor_id = d.id
       WHERE p.stock <= p.min_stock AND p.status = 'active'
       ORDER BY deficit DESC, p.stock ASC`
    );
    return res.rows;
  }

  async findVariantsByProductId(
    productId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sku',
      [productId]
    );
    return res.rows;
  }

  async getStockAdjustments(
    productId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT sa.*, u.name as user_name
       FROM stock_adjustments sa
       LEFT JOIN users u ON sa.user_id = u.id
       WHERE sa.product_id = $1
       ORDER BY sa.created_at DESC
       LIMIT 50`,
      [productId]
    );
    return res.rows;
  }

  async getPriceHistory(
    productId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT ph.*, u.name as user_name
       FROM price_history ph
       LEFT JOIN users u ON ph.user_id = u.id
       WHERE ph.product_id = $1
       ORDER BY ph.created_at DESC
       LIMIT 50`,
      [productId]
    );
    return res.rows;
  }
}

export const productsRepository = new ProductsRepository();
