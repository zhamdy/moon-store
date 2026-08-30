import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { SaleFilters, SaleCalculationSnapshot, CreateSaleCalculationInput } from './types';

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
  ): Promise<{ rows: Record<string, any>[]; total: number; totalRevenue: number }>;
  createSale(data: Record<string, any>, queryable: Queryable): Promise<Record<string, any>>;
  createSaleCalculation(data: CreateSaleCalculationInput, queryable: Queryable): Promise<void>;
  getSaleCalculationBySaleId(
    saleId: number | string,
    queryable?: Queryable
  ): Promise<SaleCalculationSnapshot | null>;
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
  decrementProductStock(
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null>;
  decrementVariantStock(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null>;
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
    const sale = res.rows[0];
    if (!sale) return null;

    // Attach the immutable calculation snapshot (migration 003), when present,
    // so historical receipts/reads never depend on current settings/formulas.
    const calculation = await this.getSaleCalculationBySaleId(sale.id, queryable);
    return calculation ? { ...sale, calculation } : sale;
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
  ): Promise<{ rows: Record<string, any>[]; total: number; totalRevenue: number }> {
    const {
      page,
      pageSize,
      search,
      paymentMethod,
      cashierId,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    } = filters;
    const offset = (page - 1) * pageSize;

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
    if (paymentMethod) {
      where.push(`s.payment_method = $${paramIdx++}`);
      params.push(paymentMethod);
    }
    if (cashierId) {
      where.push(`s.cashier_id = $${paramIdx++}`);
      params.push(cashierId);
    }
    if (dateFrom) {
      where.push(`s.created_at >= $${paramIdx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      const exclusiveDateTo = new Date(`${dateTo}T00:00:00.000Z`);
      exclusiveDateTo.setUTCDate(exclusiveDateTo.getUTCDate() + 1);
      where.push(`s.created_at < $${paramIdx++}`);
      params.push(exclusiveDateTo.toISOString());
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await this.q(queryable).query<{
      count: string | number;
      total_revenue: string | number;
    }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(s.total), 0) as total_revenue
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);
    const totalRevenue = Number(countRes.rows[0]?.total_revenue || 0);

    const queryParams = [...params, pageSize, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const orderColumn = sortBy === 'total' ? 's.total' : 's.created_at';
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const rowsRes = await this.q(queryable).query(
      `SELECT s.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone,
              COALESCE(si_counts.items_count, 0)::int as items_count
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN (
         SELECT sale_id, COUNT(*) as items_count FROM sale_items GROUP BY sale_id
       ) si_counts ON si_counts.sale_id = s.id
       ${whereClause}
       ORDER BY ${orderColumn} ${direction}, s.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return { rows: rowsRes.rows, total, totalRevenue };
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

  async createSaleCalculation(
    data: CreateSaleCalculationInput,
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      `INSERT INTO sale_calculations (
        sale_id, contract_version, subtotal, manual_discount, coupon_id, coupon_discount,
        points_redeemed, points_discount, taxable_base, tax_mode, tax_rate_percent,
        tax_amount, tip_amount, amount_due, earned_points
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        data.sale_id,
        data.contract_version,
        data.subtotal,
        data.manual_discount,
        data.coupon_id,
        data.coupon_discount,
        data.points_redeemed,
        data.points_discount,
        data.taxable_base,
        data.tax_mode,
        data.tax_rate_percent,
        data.tax_amount,
        data.tip_amount,
        data.amount_due,
        data.earned_points,
      ]
    );
  }

  async getSaleCalculationBySaleId(
    saleId: number | string,
    queryable?: Queryable
  ): Promise<SaleCalculationSnapshot | null> {
    const res = await this.q(queryable).query(
      'SELECT * FROM sale_calculations WHERE sale_id = $1',
      [saleId]
    );
    const row = res.rows[0];
    if (!row) return null;

    return {
      contractVersion: row.contract_version,
      subtotal: Number(row.subtotal),
      manualDiscount: Number(row.manual_discount),
      couponId: row.coupon_id ?? null,
      couponDiscount: Number(row.coupon_discount),
      pointsRedeemed: Number(row.points_redeemed),
      pointsDiscount: Number(row.points_discount),
      taxableBase: Number(row.taxable_base),
      taxMode: row.tax_mode,
      taxRatePercent: Number(row.tax_rate_percent),
      taxAmount: Number(row.tax_amount),
      tipAmount: Number(row.tip_amount),
      amountDue: Number(row.amount_due),
      earnedPoints: Number(row.earned_points),
    };
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

  /**
   * Conditional relative decrement. Reading a quantity and writing back an absolute
   * value computed in JavaScript loses updates: two concurrent checkouts both read
   * stock 5, both write 3, and four units vanish. Folding the sufficiency check into the
   * WHERE clause removes the stale-read window entirely — under READ COMMITTED
   * PostgreSQL re-evaluates it after a concurrent writer's row lock is released.
   *
   * @returns the resulting stock, or null when there was not enough (rowCount 0).
   *
   * `$1::int` is cast explicitly: pg-mem, which backs most of this repo's suites,
   * evaluates `column - $param` with the operands inverted unless the parameter is
   * typed, silently turning a decrement into a negation. Addition is commutative, which
   * is why the existing relative writes never exposed it.
   */
  async decrementProductStock(
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null> {
    const res = await queryable.query<{ stock: number }>(
      `UPDATE products SET stock = stock - $1::int, updated_at = NOW()
        WHERE id = $2 AND stock >= $1::int
        RETURNING stock`,
      [quantity, productId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
  }

  /** Variant counterpart of {@link decrementProductStock}. */
  async decrementVariantStock(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null> {
    const res = await queryable.query<{ stock: number }>(
      `UPDATE product_variants SET stock = stock - $1::int, updated_at = NOW()
        WHERE id = $2 AND stock >= $1::int
        RETURNING stock`,
      [quantity, variantId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
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
