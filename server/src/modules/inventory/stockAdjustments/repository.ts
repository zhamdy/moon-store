import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { StockAdjustmentRecord, StockAdjustmentFilters } from './types';

export interface IStockAdjustmentsRepository {
  list(
    filters: StockAdjustmentFilters,
    queryable?: Queryable
  ): Promise<{ rows: StockAdjustmentRecord[]; total: number }>;
  applyDelta(productId: number, delta: number, queryable: Queryable): Promise<number | null>;
  record(
    data: {
      product_id: number;
      previous_qty: number;
      new_qty: number;
      delta: number;
      reason: string;
      user_id: number;
    },
    queryable: Queryable
  ): Promise<void>;
}

export class StockAdjustmentsRepository implements IStockAdjustmentsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: StockAdjustmentFilters,
    queryable?: Queryable
  ): Promise<{ rows: StockAdjustmentRecord[]; total: number }> {
    const { page, pageSize, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const offset = (page - 1) * pageSize;

    const countResult = await this.q(queryable).query<{ count: string | number }>(
      'SELECT COUNT(*)::int as count FROM stock_adjustments'
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const result = await this.q(queryable).query<StockAdjustmentRecord>(
      `SELECT sa.*, p.name as product_name, p.sku as product_sku, u.name as user_name
       FROM stock_adjustments sa
       LEFT JOIN products p ON sa.product_id = p.id
       LEFT JOIN users u ON sa.user_id = u.id
        ORDER BY sa.created_at ${direction}, sa.id ${direction}
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return { rows: result.rows, total };
  }

  /**
   * A manual adjustment is a DELTA, so it is applied relatively and guarded in one
   * statement: reading the stock and writing back an absolute total let two concurrent
   * adjustments lose one another's change. `stock + $1::int >= 0` covers both signs, so
   * a decrement can never drive the column negative.
   *
   * A stock-COUNT reconciliation is a different operation — it asserts an observed
   * absolute quantity, so `stockCounts` writes `SET stock = $1` and is correct as is.
   *
   * `$1::int` is cast because pg-mem evaluates `column <op> $param` with the operands
   * inverted unless the parameter carries a type.
   *
   * @returns the resulting stock, or null when the delta would go below zero.
   */
  async applyDelta(productId: number, delta: number, queryable: Queryable): Promise<number | null> {
    const res = await queryable.query<{ stock: number }>(
      `UPDATE products SET stock = stock + $1::int, updated_at = NOW()
        WHERE id = $2 AND stock + $1::int >= 0
        RETURNING stock`,
      [delta, productId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
  }

  async record(
    data: {
      product_id: number;
      previous_qty: number;
      new_qty: number;
      delta: number;
      reason: string;
      user_id: number;
    },
    queryable: Queryable
  ): Promise<void> {
    await queryable.query(
      `INSERT INTO stock_adjustments (product_id, previous_qty, new_qty, delta, reason, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.product_id, data.previous_qty, data.new_qty, data.delta, data.reason, data.user_id]
    );
  }
}

export const stockAdjustmentsRepository = new StockAdjustmentsRepository();
