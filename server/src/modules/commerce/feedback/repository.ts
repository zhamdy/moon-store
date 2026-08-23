import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { CreateFeedbackDTO, FeedbackFilters, FeedbackRecord, FeedbackStats } from './types';

export interface IFeedbackRepository {
  create(data: CreateFeedbackDTO, queryable?: Queryable): Promise<FeedbackRecord>;
  list(
    filters: FeedbackFilters,
    queryable?: Queryable
  ): Promise<{ rows: FeedbackRecord[]; total: number }>;
  getStats(queryable?: Queryable): Promise<FeedbackStats>;
}

export class FeedbackRepository implements IFeedbackRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async create(data: CreateFeedbackDTO, queryable?: Queryable): Promise<FeedbackRecord> {
    const result = await this.q(queryable).query<FeedbackRecord>(
      `INSERT INTO customer_feedback (customer_id, sale_id, rating, category, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.customer_id || null,
        data.sale_id || null,
        data.rating,
        data.category || 'general',
        data.comment || null,
      ]
    );
    return result.rows[0];
  }

  async list(
    filters: FeedbackFilters,
    queryable?: Queryable
  ): Promise<{ rows: FeedbackRecord[]; total: number }> {
    const { rating, category, page: pageNum, pageSize: limitNum, sortBy, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = sortBy === 'rating' ? 'f.rating' : 'f.created_at';
    const offset = (pageNum - 1) * limitNum;

    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (rating !== undefined && rating !== null) {
      params.push(Number(rating));
      where += ` AND f.rating = $${params.length}`;
    }
    if (category) {
      params.push(category);
      where += ` AND f.category = $${params.length}`;
    }

    const countResult = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COUNT(*)::int as total FROM customer_feedback f ${where}`,
      params
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const feedback = await this.q(queryable).query<FeedbackRecord>(
      `SELECT f.*, c.name as customer_name, c.phone as customer_phone
       FROM customer_feedback f
       LEFT JOIN customers c ON f.customer_id = c.id
       ${where}
        ORDER BY ${sortColumn} ${direction}, f.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limitNum, offset]
    );

    return { rows: feedback.rows, total };
  }

  async getStats(queryable?: Queryable): Promise<FeedbackStats> {
    const stats = await this.q(queryable).query<{
      avg_rating: string | number | null;
      total_count: string | number;
      positive_count: string | number;
      negative_count: string | number;
    }>(
      `SELECT
        ROUND(AVG(rating)::numeric, 1) as avg_rating,
        COUNT(*)::int as total_count,
        SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END)::int as positive_count,
        SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END)::int as negative_count
       FROM customer_feedback`
    );
    const row = stats.rows[0];
    return {
      avg_rating: row?.avg_rating !== null ? Number(row?.avg_rating) : null,
      total_count: Number(row?.total_count || 0),
      positive_count: Number(row?.positive_count || 0),
      negative_count: Number(row?.negative_count || 0),
    };
  }
}

export const feedbackRepository = new FeedbackRepository();
