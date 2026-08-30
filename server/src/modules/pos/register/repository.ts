import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { SessionRow, MovementRow, SessionHistoryFilters, SessionHistoryResult } from './types';

export interface IRegisterRepository {
  findOpenSessionByCashierId(
    cashierId: number,
    queryable?: Queryable
  ): Promise<{ id: number; expected_cash: number } | null>;
  getCurrentSession(cashierId: number, queryable?: Queryable): Promise<SessionRow | null>;
  createSession(
    cashierId: number,
    openingFloat: number,
    queryable?: Queryable
  ): Promise<SessionRow>;
  createMovement(
    sessionId: number,
    type: string,
    amount: number,
    note?: string | null,
    saleId?: number | null,
    queryable?: Queryable
  ): Promise<MovementRow>;
  updateSessionExpectedCash(sessionId: number, delta: number, queryable?: Queryable): Promise<void>;
  closeSession(
    sessionId: number,
    countedCash: number,
    variance: number,
    notes?: string | null,
    queryable?: Queryable
  ): Promise<SessionRow>;
  findSessionById(sessionId: number | string, queryable?: Queryable): Promise<SessionRow | null>;
  findMovementsBySessionId(
    sessionId: number | string,
    queryable?: Queryable
  ): Promise<MovementRow[]>;
  listSessionHistory(
    filters: SessionHistoryFilters,
    queryable?: Queryable
  ): Promise<SessionHistoryResult>;
  forceCloseSession(sessionId: number | string, queryable?: Queryable): Promise<SessionRow | null>;
  updateSaleRegisterSession(
    saleId: number,
    sessionId: number,
    queryable?: Queryable
  ): Promise<void>;
}

export class RegisterRepository implements IRegisterRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findOpenSessionByCashierId(
    cashierId: number,
    queryable?: Queryable
  ): Promise<{ id: number; expected_cash: number } | null> {
    const res = await this.q(queryable).query<{ id: number; expected_cash: number }>(
      `SELECT id, expected_cash FROM register_sessions WHERE cashier_id = $1 AND status = 'open'`,
      [cashierId]
    );
    return res.rows[0] || null;
  }

  async getCurrentSession(cashierId: number, queryable?: Queryable): Promise<SessionRow | null> {
    const res = await this.q(queryable).query(
      `SELECT rs.id, rs.cashier_id, rs.opening_float, rs.expected_cash, rs.counted_cash,
              rs.variance, rs.status, rs.notes, rs.opened_at, rs.closed_at,
              u.name as cashier_name,
              COUNT(CASE WHEN rm.type = 'sale' THEN 1 END)::int as sale_count,
              COALESCE(SUM(CASE WHEN rm.type IN ('sale','cash_in') THEN rm.amount ELSE 0 END), 0) as total_in,
              COALESCE(SUM(CASE WHEN rm.type IN ('refund','cash_out') THEN rm.amount ELSE 0 END), 0) as total_out
       FROM register_sessions rs
       JOIN users u ON rs.cashier_id = u.id
       LEFT JOIN register_movements rm ON rm.session_id = rs.id
       WHERE rs.cashier_id = $1 AND rs.status = 'open'
       GROUP BY rs.id, rs.cashier_id, rs.opening_float, rs.expected_cash, rs.counted_cash,
                rs.variance, rs.status, rs.notes, rs.opened_at, rs.closed_at, u.name
       ORDER BY rs.opened_at DESC LIMIT 1`,
      [cashierId]
    );
    return (res.rows[0] as unknown as SessionRow) || null;
  }

  async createSession(
    cashierId: number,
    openingFloat: number,
    queryable?: Queryable
  ): Promise<SessionRow> {
    const res = await this.q(queryable).query(
      `INSERT INTO register_sessions (cashier_id, opening_float, expected_cash) VALUES ($1, $2, $3) RETURNING *`,
      [cashierId, openingFloat, openingFloat]
    );
    return res.rows[0] as unknown as SessionRow;
  }

  async createMovement(
    sessionId: number,
    type: string,
    amount: number,
    note?: string | null,
    saleId?: number | null,
    queryable?: Queryable
  ): Promise<MovementRow> {
    const res = await this.q(queryable).query(
      `INSERT INTO register_movements (session_id, type, amount, note, sale_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [sessionId, type, amount, note || null, saleId || null]
    );
    return res.rows[0] as unknown as MovementRow;
  }

  async updateSessionExpectedCash(
    sessionId: number,
    delta: number,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `UPDATE register_sessions SET expected_cash = expected_cash + $1 WHERE id = $2`,
      [delta, sessionId]
    );
  }

  async closeSession(
    sessionId: number,
    countedCash: number,
    variance: number,
    notes?: string | null,
    queryable?: Queryable
  ): Promise<SessionRow> {
    const res = await this.q(queryable).query(
      `UPDATE register_sessions
       SET status = 'closed', closed_at = NOW(), counted_cash = $1, variance = $2, notes = $3
       WHERE id = $4
       RETURNING *`,
      [countedCash, variance, notes || null, sessionId]
    );
    return res.rows[0] as unknown as SessionRow;
  }

  async findSessionById(
    sessionId: number | string,
    queryable?: Queryable
  ): Promise<SessionRow | null> {
    const res = await this.q(queryable).query(
      `SELECT rs.*, u.name as cashier_name
       FROM register_sessions rs
       JOIN users u ON rs.cashier_id = u.id
       WHERE rs.id = $1`,
      [sessionId]
    );
    return (res.rows[0] as unknown as SessionRow) || null;
  }

  async findMovementsBySessionId(
    sessionId: number | string,
    queryable?: Queryable
  ): Promise<MovementRow[]> {
    const res = await this.q(queryable).query(
      `SELECT * FROM register_movements WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );
    return res.rows as unknown as MovementRow[];
  }

  async listSessionHistory(
    filters: SessionHistoryFilters,
    queryable?: Queryable
  ): Promise<SessionHistoryResult> {
    const { page, pageSize, cashierId, from, to, sortBy, sortOrder } = filters;
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (cashierId) {
      where.push(`rs.cashier_id = $${paramIdx++}`);
      params.push(cashierId);
    }
    if (from) {
      where.push(`rs.opened_at >= $${paramIdx++}`);
      params.push(from);
    }
    if (to) {
      where.push(`rs.opened_at <= $${paramIdx++}`);
      params.push(to + ' 23:59:59');
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COUNT(*) as total FROM register_sessions rs ${whereClause}`,
      params
    );

    const queryParams = [...params, pageSize, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const result = await this.q(queryable).query(
      `SELECT rs.id, rs.cashier_id, rs.opening_float, rs.expected_cash, rs.counted_cash,
              rs.variance, rs.status, rs.notes, rs.opened_at, rs.closed_at,
              u.name as cashier_name,
              COUNT(CASE WHEN rm.type = 'sale' THEN 1 END)::int as sale_count,
              COALESCE(SUM(CASE WHEN rm.type = 'sale' THEN rm.amount ELSE 0 END), 0) as total_sales
       FROM register_sessions rs
       JOIN users u ON rs.cashier_id = u.id
       LEFT JOIN register_movements rm ON rm.session_id = rs.id
       ${whereClause}
       GROUP BY rs.id, rs.cashier_id, rs.opening_float, rs.expected_cash, rs.counted_cash,
                rs.variance, rs.status, rs.notes, rs.opened_at, rs.closed_at, u.name
       ORDER BY ${sortBy === 'closedAt' ? 'rs.closed_at' : 'rs.opened_at'} ${sortOrder.toUpperCase()}, rs.id ${sortOrder.toUpperCase()}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return {
      rows: result.rows as unknown as SessionRow[],
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async forceCloseSession(
    sessionId: number | string,
    queryable?: Queryable
  ): Promise<SessionRow | null> {
    const res = await this.q(queryable).query(
      `UPDATE register_sessions
       SET status = 'closed', closed_at = NOW(), notes = COALESCE(notes || ' | ', '') || 'Force-closed by admin'
       WHERE id = $1 AND status = 'open'
       RETURNING *`,
      [sessionId]
    );
    return (res.rows[0] as unknown as SessionRow) || null;
  }

  async updateSaleRegisterSession(
    saleId: number,
    sessionId: number,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query(`UPDATE sales SET register_session_id = $1 WHERE id = $2`, [
      sessionId,
      saleId,
    ]);
  }
}

export const registerRepository = new RegisterRepository();
