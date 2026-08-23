import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { StockAdjustmentRecord, StockAdjustmentFilters } from './types';

export interface IStockAdjustmentsRepository {
  list(
    filters: StockAdjustmentFilters,
    queryable?: Queryable
  ): Promise<{ rows: StockAdjustmentRecord[]; total: number }>;
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
}

export const stockAdjustmentsRepository = new StockAdjustmentsRepository();
