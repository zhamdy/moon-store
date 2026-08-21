import { Queryable } from '../../database/transaction';
import pool from '../../database/pool';
import { ExpenseFilters, CreateExpenseDTO, PnLStatement } from './types';

export interface IExpensesRepository {
  list(
    filters: ExpenseFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number; total_amount: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  create(
    data: CreateExpenseDTO,
    userId: number,
    queryable?: Queryable
  ): Promise<Record<string, any>>;
  update(
    id: number | string,
    data: CreateExpenseDTO,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
  getPnL(from: string, to: string, queryable?: Queryable): Promise<PnLStatement>;
}

export class ExpensesRepository implements IExpensesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(
    filters: ExpenseFilters,
    queryable?: Queryable
  ): Promise<{ rows: Record<string, any>[]; total: number; total_amount: number }> {
    const { page = 1, limit = 25, category, from, to } = filters;
    const offset = (page - 1) * limit;

    let where = '1=1';
    const params: unknown[] = [];

    if (category) {
      params.push(category);
      where += ` AND category = $${params.length}`;
    }
    if (from) {
      params.push(from);
      where += ` AND date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      where += ` AND date <= $${params.length}`;
    }

    const countRes = await this.q(queryable).query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM expenses WHERE ${where}`,
      params
    );
    const sumRes = await this.q(queryable).query<{ total_amount: string | number }>(
      `SELECT COALESCE(SUM(amount), 0) as total_amount FROM expenses WHERE ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const rowsRes = await this.q(queryable).query(
      `SELECT e.*, u.name as user_name
       FROM expenses e LEFT JOIN users u ON e.user_id = u.id
       WHERE ${where}
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limit, offset]
    );

    return {
      rows: rowsRes.rows,
      total: Number(countRes.rows[0]?.total || 0),
      total_amount: Number(sumRes.rows[0]?.total_amount || 0),
    };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM expenses WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async create(
    data: CreateExpenseDTO,
    userId: number,
    queryable?: Queryable
  ): Promise<Record<string, any>> {
    const res = await this.q(queryable).query(
      `INSERT INTO expenses (category, amount, description, date, recurring, user_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.category,
        data.amount,
        data.description || null,
        data.date || new Date().toISOString().split('T')[0],
        data.recurring || 'one_time',
        userId,
      ]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: CreateExpenseDTO,
    queryable?: Queryable
  ): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query(
      `UPDATE expenses SET category = $1, amount = $2, description = $3, date = $4, recurring = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [
        data.category,
        data.amount,
        data.description || null,
        data.date || new Date().toISOString().split('T')[0],
        data.recurring || 'one_time',
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query('DELETE FROM expenses WHERE id = $1 RETURNING id', [
      id,
    ]);
    return res.rows.length > 0;
  }

  async getPnL(from: string, to: string, queryable?: Queryable): Promise<PnLStatement> {
    const revenueRes = await this.q(queryable).query<{ revenue: string | number }>(
      `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue
       FROM sales WHERE created_at::date >= $1 AND created_at::date <= $2`,
      [from, to]
    );

    const cogsRes = await this.q(queryable).query<{ cogs: string | number }>(
      `SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) as cogs
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.created_at::date >= $1 AND s.created_at::date <= $2`,
      [from, to]
    );

    const expensesByCategoryRes = await this.q(queryable).query(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM expenses WHERE date >= $1 AND date <= $2
       GROUP BY category`,
      [from, to]
    );

    const totalExpensesRes = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= $1 AND date <= $2`,
      [from, to]
    );

    const revenue = Number(revenueRes.rows[0]?.revenue || 0);
    const cogs = Number(cogsRes.rows[0]?.cogs || 0);
    const gross_profit = revenue - cogs;
    const operating_expenses = Number(totalExpensesRes.rows[0]?.total || 0);
    const net_profit = gross_profit - operating_expenses;

    return {
      period: { from, to },
      revenue,
      cogs,
      gross_profit,
      operating_expenses,
      expenses_by_category: expensesByCategoryRes.rows,
      net_profit,
    };
  }
}

export const expensesRepository = new ExpensesRepository();
