import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  RawSalesHistoryRow,
  RawCoPurchasedRow,
  RawTopPairRow,
  RawDeadStockRow,
  RawFastMoverRow,
  RawCustomerOrderRow,
  RawHighDiscountRow,
  RawLargeReturnRow,
  RawCashierRefundRow,
} from './types';

export interface IAiRepository {
  getSalesHistoryForForecast(queryable?: Queryable): Promise<RawSalesHistoryRow[]>;
  getCoPurchasedProducts(productId: number, queryable?: Queryable): Promise<RawCoPurchasedRow[]>;
  getTopPairs(queryable?: Queryable): Promise<RawTopPairRow[]>;
  getDeadStockForPricing(queryable?: Queryable): Promise<RawDeadStockRow[]>;
  getFastMoversForPricing(queryable?: Queryable): Promise<RawFastMoverRow[]>;
  getCustomersForChurnRisk(queryable?: Queryable): Promise<RawCustomerOrderRow[]>;
  getHighDiscountSales(queryable?: Queryable): Promise<RawHighDiscountRow[]>;
  getLargeDamageWriteoffs(queryable?: Queryable): Promise<RawLargeReturnRow[]>;
  getCashierRefundStats(queryable?: Queryable): Promise<RawCashierRefundRow[]>;
}

export class AiRepository implements IAiRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async getSalesHistoryForForecast(queryable?: Queryable): Promise<RawSalesHistoryRow[]> {
    const result = await this.q(queryable).query<RawSalesHistoryRow>(
      `SELECT
        si.product_id,
        p.name as product_name,
        p.stock as current_stock,
        p.min_stock,
        p.price,
        c.name as category_name,
        COALESCE(SUM(si.quantity), 0)::int as total_sold_90d,
        ROUND(COALESCE(SUM(si.quantity), 0) / 90.0, 2) as daily_velocity
       FROM products p
       LEFT JOIN sale_items si ON p.id = si.product_id
       LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '90 days' AND s.status != 'voided'
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status = 'active'
       GROUP BY p.id, p.name, p.stock, p.min_stock, p.price, c.name`
    );
    return result.rows;
  }

  async getCoPurchasedProducts(
    productId: number,
    queryable?: Queryable
  ): Promise<RawCoPurchasedRow[]> {
    const result = await this.q(queryable).query<RawCoPurchasedRow>(
      `SELECT
        si2.product_id as recommended_product_id,
        p.name as product_name,
        p.price,
        p.stock,
        p.image_url,
        c.name as category_name,
        COUNT(*)::int as co_occurrence_count
       FROM sale_items si1
       JOIN sale_items si2 ON si1.sale_id = si2.sale_id AND si1.product_id != si2.product_id
       JOIN products p ON si2.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       JOIN sales s ON si1.sale_id = s.id AND s.status != 'voided'
       WHERE si1.product_id = $1 AND p.status = 'active' AND p.stock > 0
       GROUP BY si2.product_id, p.name, p.price, p.stock, p.image_url, c.name
       ORDER BY co_occurrence_count DESC
       LIMIT 5`,
      [productId]
    );
    return result.rows;
  }

  async getTopPairs(queryable?: Queryable): Promise<RawTopPairRow[]> {
    const result = await this.q(queryable).query<RawTopPairRow>(
      `SELECT
        si1.product_id as product_a_id,
        p1.name as product_a_name,
        si2.product_id as product_b_id,
        p2.name as product_b_name,
        COUNT(*)::int as frequency
       FROM sale_items si1
       JOIN sale_items si2 ON si1.sale_id = si2.sale_id AND si1.product_id < si2.product_id
       JOIN products p1 ON si1.product_id = p1.id
       JOIN products p2 ON si2.product_id = p2.id
       JOIN sales s ON si1.sale_id = s.id AND s.status != 'voided'
       WHERE p1.status = 'active' AND p2.status = 'active'
       GROUP BY si1.product_id, p1.name, si2.product_id, p2.name
       HAVING COUNT(*) >= 2
       ORDER BY frequency DESC
       LIMIT 20`
    );
    return result.rows;
  }

  async getDeadStockForPricing(queryable?: Queryable): Promise<RawDeadStockRow[]> {
    const result = await this.q(queryable).query<RawDeadStockRow>(
      `SELECT
        p.id,
        p.name,
        p.price,
        p.cost_price,
        p.stock,
        c.name as category_name,
        COALESCE(SUM(si.quantity), 0)::int as sales_30d
       FROM products p
       LEFT JOIN sale_items si ON p.id = si.product_id
       LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '30 days' AND s.status != 'voided'
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status = 'active' AND p.stock > 5
       GROUP BY p.id, p.name, p.price, p.cost_price, p.stock, c.name
       HAVING COALESCE(SUM(si.quantity), 0) = 0
       ORDER BY p.stock DESC
       LIMIT 10`
    );
    return result.rows;
  }

  async getFastMoversForPricing(queryable?: Queryable): Promise<RawFastMoverRow[]> {
    const result = await this.q(queryable).query<RawFastMoverRow>(
      `SELECT
        p.id,
        p.name,
        p.price,
        p.cost_price,
        p.stock,
        c.name as category_name,
        SUM(si.quantity)::int as sales_30d
       FROM products p
       JOIN sale_items si ON p.id = si.product_id
       JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '30 days' AND s.status != 'voided'
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status = 'active'
       GROUP BY p.id, p.name, p.price, p.cost_price, p.stock, c.name
       HAVING SUM(si.quantity) >= 20
       ORDER BY sales_30d DESC
       LIMIT 10`
    );
    return result.rows;
  }

  async getCustomersForChurnRisk(queryable?: Queryable): Promise<RawCustomerOrderRow[]> {
    const result = await this.q(queryable).query<RawCustomerOrderRow>(
      `SELECT
        c.id,
        c.name,
        c.phone,
        c.loyalty_points,
        COUNT(s.id)::int as total_orders,
        COALESCE(SUM(s.total), 0) as total_spent,
        MAX(s.created_at)::text as last_order_date,
        ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(s.created_at)::timestamp)) / 86400.0) as days_since_last_order
       FROM customers c
       JOIN sales s ON c.id = s.customer_id AND s.status != 'voided'
       GROUP BY c.id, c.name, c.phone, c.loyalty_points
       HAVING COUNT(s.id) >= 2
       ORDER BY days_since_last_order DESC`
    );
    return result.rows;
  }

  async getHighDiscountSales(queryable?: Queryable): Promise<RawHighDiscountRow[]> {
    const result = await this.q(queryable).query<RawHighDiscountRow>(
      `SELECT s.id, s.receipt_number, s.total, s.discount, s.subtotal, u.name as cashier_name, s.created_at::text as created_at
       FROM sales s
       LEFT JOIN users u ON s.cashier_id = u.id
       WHERE s.subtotal > 0 AND (s.discount / s.subtotal) >= 0.3 AND s.status != 'voided'
       ORDER BY s.created_at DESC LIMIT 10`
    );
    return result.rows;
  }

  async getLargeDamageWriteoffs(queryable?: Queryable): Promise<RawLargeReturnRow[]> {
    const result = await this.q(queryable).query<RawLargeReturnRow>(
      `SELECT sa.id, sa.product_id, p.name as product_name, sa.delta, sa.reason, u.name as user_name, sa.created_at::text as created_at
       FROM stock_adjustments sa
       JOIN products p ON sa.product_id = p.id
       LEFT JOIN users u ON sa.user_id = u.id
       WHERE sa.delta < -10 AND sa.reason = 'Damaged'
       ORDER BY sa.created_at DESC LIMIT 5`
    );
    return result.rows;
  }

  async getCashierRefundStats(queryable?: Queryable): Promise<RawCashierRefundRow[]> {
    const result = await this.q(queryable).query<RawCashierRefundRow>(
      `SELECT
        u.name as cashier_name,
        COUNT(s.id)::int as total_sales,
        SUM(CASE WHEN s.status IN ('refunded', 'partially_refunded') THEN 1 ELSE 0 END)::int as refunded_count,
        COALESCE(SUM(s.refunded_amount), 0) as total_refunded_amount
       FROM sales s
       JOIN users u ON s.cashier_id = u.id
       WHERE s.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY u.id, u.name
       HAVING COUNT(s.id) >= 10 AND (SUM(CASE WHEN s.status IN ('refunded', 'partially_refunded') THEN 1 ELSE 0 END) / COUNT(s.id)::float) >= 0.15`
    );
    return result.rows;
  }
}

export const aiRepository = new AiRepository();
