import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { SaleFilters } from './types';

export interface ISalesRepository {
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findItemsBySaleId(saleId: number | string, queryable?: Queryable): Promise<Record<string, any>[]>;
  findPaymentsBySaleId(
    saleId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]>;
  findRefundsBySaleId(
    saleId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]>;
  listSales(
    filters: SaleFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }>;
  createSale(data: Record<string, any>, queryable: Queryable): Promise<Record<string, any>>;
  createSaleItem(data: Record<string, any>, queryable: Queryable): Promise<Record<string, any>>;
  createSalePayment(
    saleId: number,
    method: string,
    amount: number,
    queryable: Queryable
  ): Promise<void>;
  createCouponUsage(
    couponId: number,
    saleId: number,
    customerId: number | null,
    discount: number,
    queryable: Queryable
  ): Promise<void>;
  updateCustomerLoyalty(
    customerId: number,
    deltaPoints: number,
    queryable: Queryable
  ): Promise<void>;
  createLoyaltyTransaction(
    customerId: number,
    saleId: number,
    points: number,
    type: string,
    note: string,
    queryable: Queryable
  ): Promise<void>;
  createRefund(data: Record<string, any>, queryable: Queryable): Promise<Record<string, any>>;
  updateSaleRefundStatus(
    saleId: number,
    refundStatus: string,
    refundedAmount: number,
    queryable: Queryable
  ): Promise<void>;
  getProductById(productId: number, queryable?: Queryable): Promise<Record<string, any> | null>;
  getProductVariantById(
    variantId: number,
    productId: number,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  updateProductStock(productId: number, newStock: number, queryable: Queryable): Promise<void>;
  updateVariantStock(variantId: number, newStock: number, queryable: Queryable): Promise<void>;
  createStockAdjustment(data: Record<string, any>, queryable: Queryable): Promise<void>;
  getSetting(key: string, queryable?: Queryable): Promise<string | undefined>;
  getCouponByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  getCouponUsageCount(couponId: number, queryable?: Queryable): Promise<number>;
  getCustomerById(customerId: number, queryable?: Queryable): Promise<Record<string, any> | null>;
}

export class SalesRepository implements ISalesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `SELECT s.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async findItemsBySaleId(
    saleId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT si.*, p.name as product_name, p.sku as product_sku,
              pv.sku as variant_sku, pv.attributes as variant_attributes
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       LEFT JOIN product_variants pv ON si.variant_id = pv.id
       WHERE si.sale_id = $1`,
      [saleId]
    );
    return res.rows.map((row: any) => ({
      ...row,
      variant_attributes:
        typeof row.variant_attributes === 'string'
          ? JSON.parse(row.variant_attributes)
          : row.variant_attributes || null,
    }));
  }

  async findPaymentsBySaleId(
    saleId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      'SELECT * FROM sale_payments WHERE sale_id = $1 ORDER BY id ASC',
      [saleId]
    );
    return res.rows;
  }

  async findRefundsBySaleId(
    saleId: number | string,
    queryable?: Queryable
  ): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT r.*, u.name as cashier_name
       FROM refunds r
       LEFT JOIN users u ON r.cashier_id = u.id
       WHERE r.sale_id = $1
       ORDER BY r.created_at DESC`,
      [saleId]
    );
    return res.rows;
  }

  async listSales(
    filters: SaleFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }> {
    const { page = 1, limit = 25, search, payment_method, cashier_id, from, to } = filters;
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      where.push(
        `(u.name ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx} OR c.phone ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (payment_method) {
      where.push(`s.payment_method = $${paramIdx++}`);
      params.push(payment_method);
    }
    if (cashier_id) {
      where.push(`s.cashier_id = $${paramIdx++}`);
      params.push(cashier_id);
    }
    if (from) {
      where.push(`s.created_at >= $${paramIdx++}`);
      params.push(from);
    }
    if (to) {
      where.push(`s.created_at <= $${paramIdx++}`);
      params.push(to + ' 23:59:59');
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const queryParams = [...params, limit, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const rowsRes = await this.q(queryable).query(
      `SELECT s.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return { rows: rowsRes.rows, total };
  }

  async createSale(data: Record<string, any>, queryable: Queryable): Promise<Record<string, any>> {
    const res = await queryable.query(
      `INSERT INTO sales (
        total, discount, discount_type, payment_method, cashier_id, customer_id,
        tax_amount, points_redeemed, notes, tip_amount, coupon_id, coupon_discount
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        data.total,
        data.discount,
        data.discount_type,
        data.payment_method,
        data.cashier_id,
        data.customer_id || null,
        data.tax_amount,
        data.points_redeemed || 0,
        data.notes || null,
        data.tip_amount || 0,
        data.coupon_id || null,
        data.coupon_discount || 0,
      ]
    );
    return res.rows[0];
  }

  async createSaleItem(
    data: Record<string, any>,
    queryable: Queryable
  ): Promise<Record<string, any>> {
    const res = await queryable.query(
      `INSERT INTO sale_items (sale_id, product_id, variant_id, quantity, unit_price, cost_price, memo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.sale_id,
        data.product_id,
        data.variant_id || null,
        data.quantity,
        data.unit_price,
        data.cost_price || 0,
        data.memo || null,
      ]
    );
    return res.rows[0];
  }

  async createSalePayment(
    saleId: number,
    method: string,
    amount: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'INSERT INTO sale_payments (sale_id, method, amount) VALUES ($1, $2, $3)',
      [saleId, method, amount]
    );
  }

  async createCouponUsage(
    couponId: number,
    saleId: number,
    customerId: number | null,
    discount: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'INSERT INTO coupon_usage (coupon_id, sale_id, customer_id, discount_applied) VALUES ($1, $2, $3, $4)',
      [couponId, saleId, customerId, discount]
    );
  }

  async updateCustomerLoyalty(
    customerId: number,
    deltaPoints: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'UPDATE customers SET loyalty_points = loyalty_points + $1, updated_at = NOW() WHERE id = $2',
      [deltaPoints, customerId]
    );
  }

  async createLoyaltyTransaction(
    customerId: number,
    saleId: number,
    points: number,
    type: string,
    note: string,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'INSERT INTO loyalty_transactions (customer_id, sale_id, points, type, note) VALUES ($1, $2, $3, $4, $5)',
      [customerId, saleId, points, type, note]
    );
  }

  async createRefund(
    data: Record<string, any>,
    queryable: Queryable
  ): Promise<Record<string, any>> {
    const res = await queryable.query(
      `INSERT INTO refunds (sale_id, amount, reason, items, restock, cashier_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.sale_id,
        data.amount,
        data.reason,
        JSON.stringify(data.items),
        data.restock ? 1 : 0,
        data.cashier_id,
      ]
    );
    return res.rows[0];
  }

  async updateSaleRefundStatus(
    saleId: number,
    refundStatus: string,
    refundedAmount: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'UPDATE sales SET refund_status = $1, refunded_amount = $2 WHERE id = $3',
      [refundStatus, refundedAmount, saleId]
    );
  }

  async getProductById(
    productId: number,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM products WHERE id = $1', [productId]);
    return res.rows[0] || null;
  }

  async getProductVariantById(
    variantId: number,
    productId: number,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      'SELECT * FROM product_variants WHERE id = $1 AND product_id = $2',
      [variantId, productId]
    );
    return res.rows[0] || null;
  }

  async updateProductStock(
    productId: number,
    newStock: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query('UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2', [
      newStock,
      productId,
    ]);
  }

  async updateVariantStock(
    variantId: number,
    newStock: number,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      'UPDATE product_variants SET stock = $1, updated_at = NOW() WHERE id = $2',
      [newStock, variantId]
    );
  }

  async createStockAdjustment(data: Record<string, any>, queryable: Queryable): Promise<void> {
    await queryable.query(
      'INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [data.product_id, data.previous_qty, data.new_qty, data.delta, data.reason, data.user_id]
    );
  }

  async getSetting(key: string, queryable?: Queryable): Promise<string | undefined> {
    const res = await this.q(queryable).query<{ value: string }>(
      'SELECT value FROM settings WHERE key = $1',
      [key]
    );
    return res.rows[0]?.value;
  }

  async getCouponByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      "SELECT * FROM coupons WHERE code = $1 AND status = 'active'",
      [code]
    );
    return res.rows[0] || null;
  }

  async getCouponUsageCount(couponId: number, queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query<{ c: string | number }>(
      'SELECT COUNT(*)::int as c FROM coupon_usage WHERE coupon_id = $1',
      [couponId]
    );
    return Number(res.rows[0]?.c || 0);
  }

  async getCustomerById(
    customerId: number,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM customers WHERE id = $1', [
      customerId,
    ]);
    return res.rows[0] || null;
  }
}

export const salesRepository = new SalesRepository();
