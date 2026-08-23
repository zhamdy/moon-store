import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { ShiftRow } from './types';

export interface IShiftsRepository {
  findActiveShift(userId: number, queryable?: Queryable): Promise<ShiftRow | null>;
  getCurrentShift(userId: number, queryable?: Queryable): Promise<ShiftRow | null>;
  clockIn(
    userId: number,
    branchId?: number | null,
    notes?: string | null,
    queryable?: Queryable
  ): Promise<ShiftRow>;
  endBreak(shiftId: number, queryable?: Queryable): Promise<ShiftRow>;
  startBreak(shiftId: number, queryable?: Queryable): Promise<ShiftRow>;
  clockOut(shiftId: number, notes?: string | null, queryable?: Queryable): Promise<ShiftRow>;
  listShifts(
    filters: {
      targetUserId?: number;
      from?: string;
      to?: string;
      status?: 'open' | 'completed';
      sortBy: 'clockIn' | 'clockOut';
      sortOrder: 'asc' | 'desc';
      limit: number;
      offset: number;
    },
    queryable?: Queryable
  ): Promise<{ rows: ShiftRow[]; total: number }>;
}

export class ShiftsRepository implements IShiftsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findActiveShift(userId: number, queryable?: Queryable): Promise<ShiftRow | null> {
    const res = await this.q(queryable).query(
      `SELECT * FROM shifts WHERE user_id = $1 AND status IN ('active', 'on_break') ORDER BY clock_in DESC LIMIT 1`,
      [userId]
    );
    return (res.rows[0] as unknown as ShiftRow) || null;
  }

  async getCurrentShift(userId: number, queryable?: Queryable): Promise<ShiftRow | null> {
    const res = await this.q(queryable).query(
      `SELECT s.*, b.name as branch_name
       FROM shifts s
       LEFT JOIN branches b ON s.branch_id = b.id
       WHERE s.user_id = $1 AND s.status IN ('active', 'on_break')
       ORDER BY s.clock_in DESC LIMIT 1`,
      [userId]
    );
    return (res.rows[0] as unknown as ShiftRow) || null;
  }

  async clockIn(
    userId: number,
    branchId?: number | null,
    notes?: string | null,
    queryable?: Queryable
  ): Promise<ShiftRow> {
    const res = await this.q(queryable).query(
      `INSERT INTO shifts (user_id, branch_id, clock_in, status, notes)
       VALUES ($1, $2, NOW(), 'active', $3) RETURNING *`,
      [userId, branchId || null, notes || null]
    );
    return res.rows[0] as unknown as ShiftRow;
  }

  async startBreak(shiftId: number, queryable?: Queryable): Promise<ShiftRow> {
    const res = await this.q(queryable).query(
      `UPDATE shifts SET status = 'on_break', break_start = NOW() WHERE id = $1 RETURNING *`,
      [shiftId]
    );
    return res.rows[0] as unknown as ShiftRow;
  }

  async endBreak(shiftId: number, queryable?: Queryable): Promise<ShiftRow> {
    const res = await this.q(queryable).query(
      `UPDATE shifts SET
         status = 'active',
         break_minutes = COALESCE(break_minutes, 0) + GREATEST(0, EXTRACT(EPOCH FROM (NOW() - break_start::timestamp)) / 60)::int,
         break_start = NULL
       WHERE id = $1 RETURNING *`,
      [shiftId]
    );
    return res.rows[0] as unknown as ShiftRow;
  }

  async clockOut(shiftId: number, notes?: string | null, queryable?: Queryable): Promise<ShiftRow> {
    const res = await this.q(queryable).query(
      `UPDATE shifts SET
         clock_out = NOW(),
         total_hours = ROUND((GREATEST(0, EXTRACT(EPOCH FROM (NOW() - clock_in::timestamp)) / 3600.0) - COALESCE(break_minutes, 0) / 60.0)::numeric, 2),
         status = 'completed',
         notes = COALESCE($1, notes)
       WHERE id = $2 RETURNING *`,
      [notes || null, shiftId]
    );
    return res.rows[0] as unknown as ShiftRow;
  }

  async listShifts(
    filters: {
      targetUserId?: number;
      from?: string;
      to?: string;
      status?: 'open' | 'completed';
      sortBy: 'clockIn' | 'clockOut';
      sortOrder: 'asc' | 'desc';
      limit: number;
      offset: number;
    },
    queryable?: Queryable
  ): Promise<{ rows: ShiftRow[]; total: number }> {
    const { targetUserId, from, to, status, sortBy, sortOrder, limit, offset } = filters;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (targetUserId !== undefined) {
      params.push(targetUserId);
      where += ` AND s.user_id = $${params.length}`;
    }
    if (from) {
      params.push(from);
      where += ` AND s.clock_in >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where += ` AND s.clock_in <= $${params.length}`;
    }
    if (status === 'open') {
      where += " AND s.status IN ('active', 'on_break')";
    } else if (status === 'completed') {
      where += " AND s.status = 'completed'";
    }

    const countResult = await this.q(queryable).query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM shifts s ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const res = await this.q(queryable).query(
      `SELECT s.*, u.name as user_name, u.email as user_email, b.name as branch_name
       FROM shifts s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN branches b ON s.branch_id = b.id
       ${where}
       ORDER BY ${sortBy === 'clockOut' ? 's.clock_out' : 's.clock_in'} ${sortOrder.toUpperCase()}, s.id ${sortOrder.toUpperCase()}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limit, offset]
    );

    return {
      rows: res.rows as unknown as ShiftRow[],
      total: Number(countResult.rows[0]?.total || 0),
    };
  }
}

export const shiftsRepository = new ShiftsRepository();
