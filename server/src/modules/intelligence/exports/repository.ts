import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';

export interface IExportsRepository {
  getProductsForExport(queryable?: Queryable): Promise<Record<string, unknown>[]>;
  getSalesForExport(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Record<string, unknown>[]>;
  getCustomersForExport(queryable?: Queryable): Promise<Record<string, unknown>[]>;
}

export class ExportsRepository implements IExportsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async getProductsForExport(queryable?: Queryable): Promise<Record<string, unknown>[]> {
    const result = await this.q(queryable).query<Record<string, unknown>>(
      `SELECT p.id, p.name, p.sku, p.barcode, p.price, p.cost_price, p.stock, p.min_stock,
              c.name as category, d.name as distributor, p.status, p.created_at
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN distributors d ON p.distributor_id = d.id
       ORDER BY p.name ASC`
    );
    return result.rows;
  }

  async getSalesForExport(
    whereClause: string,
    params: unknown[],
    queryable?: Queryable
  ): Promise<Record<string, unknown>[]> {
    const result = await this.q(queryable).query<Record<string, unknown>>(
      `SELECT s.receipt_number, s.created_at, u.name as cashier, c.name as customer, c.phone as customer_phone,
              s.subtotal, s.discount, s.tax, s.total, s.payment_method, s.status, s.notes
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       ${whereClause}
       ORDER BY s.created_at DESC`,
      params
    );
    return result.rows;
  }

  async getCustomersForExport(queryable?: Queryable): Promise<Record<string, unknown>[]> {
    const result = await this.q(queryable).query<Record<string, unknown>>(
      `SELECT c.id, c.name, c.phone, c.address, c.notes, c.loyalty_points, c.created_at,
              COALESCE(SUM(s.total), 0) as total_spent,
              COUNT(s.id)::int as total_orders
       FROM customers c
       LEFT JOIN sales s ON s.customer_id = c.id
       GROUP BY c.id, c.name, c.phone, c.address, c.notes, c.loyalty_points, c.created_at
       ORDER BY c.name ASC`
    );
    return result.rows;
  }
}

export const exportsRepository = new ExportsRepository();
