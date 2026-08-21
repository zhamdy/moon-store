import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { GiftCardFilters, GiftCardListResult } from './types';

export interface IGiftCardsRepository {
  list(filters: GiftCardFilters, queryable?: Queryable): Promise<GiftCardListResult>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  getMaxBarcode(prefix: string, queryable?: Queryable): Promise<string | null>;
  create(
    data: {
      code: string;
      barcode: string;
      initial_value: number;
      customer_id?: number | null;
      expires_at?: string | null;
      created_by: number;
    },
    queryable?: Queryable
  ): Promise<Record<string, any>>;
  updateBalance(id: number, newBalance: number, queryable?: Queryable): Promise<void>;
  createTransaction(
    data: {
      gift_card_id: number;
      sale_id: number;
      amount: number;
      balance_before: number;
      balance_after: number;
      performed_by: number;
    },
    queryable?: Queryable
  ): Promise<Record<string, any>>;
  getTransactions(id: number, queryable?: Queryable): Promise<Record<string, any>[]>;
  updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
}

export class GiftCardsRepository implements IGiftCardsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(filters: GiftCardFilters, queryable?: Queryable): Promise<GiftCardListResult> {
    const { page = 1, limit = 25, status, search } = filters;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (status && status !== 'all') {
      where.push(`gc.status = $${paramIdx++}`);
      params.push(status);
    }
    if (search) {
      where.push(`(gc.code ILIKE $${paramIdx} OR gc.barcode ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM gift_cards gc ${whereClause}`,
      params
    );
    const total = Number(countResult.rows[0]?.count || 0);

    const queryParams = [...params, limitNum, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const result = await this.q(queryable).query(
      `SELECT gc.*,
              COALESCE(t_agg.transaction_count, 0)::int as transaction_count,
              COALESCE(t_agg.total_redeemed, 0) as total_redeemed
       FROM gift_cards gc
       LEFT JOIN (
         SELECT gift_card_id, COUNT(*) as transaction_count, SUM(amount) as total_redeemed
         FROM gift_card_transactions GROUP BY gift_card_id
       ) t_agg ON t_agg.gift_card_id = gc.id
       ${whereClause}
       ORDER BY gc.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return {
      rows: result.rows,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM gift_cards WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async findByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM gift_cards WHERE code = $1', [code]);
    return res.rows[0] || null;
  }

  async getMaxBarcode(prefix: string, queryable?: Queryable): Promise<string | null> {
    const maxResult = await this.q(queryable).query<{ max_bc: string | null }>(
      `SELECT MAX(barcode) as max_bc FROM gift_cards WHERE barcode LIKE $1 AND LENGTH(barcode) = 13`,
      [`${prefix}%`]
    );
    return maxResult.rows[0]?.max_bc || null;
  }

  async create(
    data: {
      code: string;
      barcode: string;
      initial_value: number;
      customer_id?: number | null;
      expires_at?: string | null;
      created_by: number;
    },
    queryable?: Queryable
  ): Promise<Record<string, any>> {
    const result = await this.q(queryable).query(
      `INSERT INTO gift_cards (code, barcode, initial_value, balance, customer_id, expires_at, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7) RETURNING *`,
      [
        data.code,
        data.barcode,
        data.initial_value,
        data.initial_value,
        data.customer_id || null,
        data.expires_at || null,
        data.created_by,
      ]
    );
    return result.rows[0];
  }

  async updateBalance(id: number, newBalance: number, queryable?: Queryable): Promise<void> {
    await this.q(queryable).query(
      'UPDATE gift_cards SET balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, id]
    );
  }

  async createTransaction(
    data: {
      gift_card_id: number;
      sale_id: number;
      amount: number;
      balance_before: number;
      balance_after: number;
      performed_by: number;
    },
    queryable?: Queryable
  ): Promise<Record<string, any>> {
    const txRes = await this.q(queryable).query<Record<string, any>>(
      `INSERT INTO gift_card_transactions (gift_card_id, sale_id, amount, balance_before, balance_after, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.gift_card_id,
        data.sale_id,
        data.amount,
        data.balance_before,
        data.balance_after,
        data.performed_by,
      ]
    );
    return txRes.rows[0];
  }

  async getTransactions(id: number, queryable?: Queryable): Promise<Record<string, any>[]> {
    const result = await this.q(queryable).query(
      `SELECT t.*, u.name as performed_by_name
       FROM gift_card_transactions t
       LEFT JOIN users u ON t.performed_by = u.id
       WHERE t.gift_card_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );
    return result.rows;
  }

  async updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const result = await this.q(queryable).query(
      `UPDATE gift_cards SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  }
}

export const giftCardsRepository = new GiftCardsRepository();
