import { Queryable } from '../../database/transaction';
import pool from '../../database/pool';
import { GiftCardFilters } from './types';

export interface IGiftCardsRepository {
  list(
    filters: GiftCardFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  findByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null>;
  create(data: Record<string, any>, queryable?: Queryable): Promise<Record<string, any>>;
  updateBalance(id: number, balance: number, queryable: Queryable): Promise<void>;
  updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  createTransaction(data: Record<string, any>, queryable: Queryable): Promise<Record<string, any>>;
  getTransactions(id: number, queryable?: Queryable): Promise<Record<string, any>[]>;
  getMaxBarcode(prefix: string, queryable?: Queryable): Promise<string | null>;
}

export class GiftCardsRepository implements IGiftCardsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: GiftCardFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number }> {
    const { page = 1, limit = 25, status, search } = filters;
    const offset = (page - 1) * limit;

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

    const countRes = await this.q(queryable).query<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM gift_cards gc ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const queryParams = [...params, limit, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const res = await this.q(queryable).query(
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

    return { rows: res.rows, total };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM gift_cards WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async findByCode(code: string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM gift_cards WHERE code = $1', [code]);
    return res.rows[0] || null;
  }

  async create(data: Record<string, any>, queryable?: Queryable): Promise<Record<string, any>> {
    const res = await this.q(queryable).query(
      `INSERT INTO gift_cards (code, barcode, initial_value, balance, customer_id, expires_at, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7) RETURNING *`,
      [
        data.code,
        data.barcode,
        data.initial_value,
        data.balance,
        data.customer_id || null,
        data.expires_at || null,
        data.created_by,
      ]
    );
    return res.rows[0];
  }

  async updateBalance(id: number, balance: number, queryable: Queryable): Promise<void> {
    await queryable.query('UPDATE gift_cards SET balance = $1, updated_at = NOW() WHERE id = $2', [
      balance,
      id,
    ]);
  }

  async updateStatus(
    id: number | string,
    status: string,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `UPDATE gift_cards SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0] || null;
  }

  async createTransaction(
    data: Record<string, any>,
    queryable: Queryable
  ): Promise<Record<string, any>> {
    const res = await queryable.query(
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
    return res.rows[0];
  }

  async getTransactions(id: number, queryable?: Queryable): Promise<Record<string, any>[]> {
    const res = await this.q(queryable).query(
      `SELECT t.*, u.name as performed_by_name
       FROM gift_card_transactions t
       LEFT JOIN users u ON t.performed_by = u.id
       WHERE t.gift_card_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );
    return res.rows;
  }

  async getMaxBarcode(prefix: string, queryable?: Queryable): Promise<string | null> {
    const res = await this.q(queryable).query<{ max_bc: string | null }>(
      `SELECT MAX(barcode) as max_bc FROM gift_cards WHERE barcode LIKE $1 AND LENGTH(barcode) = 13`,
      [`${prefix}%`]
    );
    return res.rows[0]?.max_bc || null;
  }
}

export const giftCardsRepository = new GiftCardsRepository();
