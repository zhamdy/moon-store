import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  CreateExpenseDTO,
  UpdateExpenseDTO,
  ExpenseFilters,
  ExpenseListResult,
  PnlResult,
} from './types';

export interface IExpensesRepository {
  list(filters: ExpenseFilters, queryable?: Queryable): Promise<ExpenseListResult>;
  findById(id: number | string, queryable?: Queryable): Promise<Record<string, any> | null>;
  create(
    data: CreateExpenseDTO,
    userId: number,
    queryable?: Queryable
  ): Promise<Record<string, any>>;
  update(
    id: number | string,
    data: UpdateExpenseDTO,
    queryable?: Queryable
  ): Promise<Record<string, any> | null>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
  getPnl(from: string, to: string, queryable?: Queryable): Promise<PnlResult>;
}

export class ExpensesRepository implements IExpensesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(filters: ExpenseFilters, queryable?: Queryable): Promise<ExpenseListResult> {
    const { page, pageSize, category, from, to, sortBy, sortOrder } = filters;
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const sortColumn = sortBy === 'createdAt' ? 'e.created_at' : 'e.date';
    const offset = (page - 1) * pageSize;

    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (category) {
      where.push(`category = $${paramIdx++}`);
      params.push(category);
    }
    if (from) {
      where.push(`date >= $${paramIdx++}`);
      params.push(from);
    }
    if (to) {
      where.push(`date <= $${paramIdx++}`);
      params.push(to);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const countResult = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COUNT(*) as total FROM expenses ${whereClause}`,
      params
    );
    const sumResult = await this.q(queryable).query<{ total_amount: string | number }>(
      `SELECT COALESCE(SUM(amount), 0) as total_amount FROM expenses ${whereClause}`,
      params
    );

    const queryParams = [...params, pageSize, offset];
    const limitIdx = paramIdx++;
    const offsetIdx = paramIdx++;

    const result = await this.q(queryable).query(
      `SELECT e.*, u.name as user_name
       FROM expenses e LEFT JOIN users u ON e.user_id = u.id
       ${whereClause}
        ORDER BY ${sortColumn} ${direction}, e.id ${direction}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    return {
      rows: result.rows,
      total: Number(countResult.rows[0]?.total || 0),
      total_amount: Number(sumResult.rows[0]?.total_amount || 0),
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
    data: UpdateExpenseDTO,
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

  async getPnl(from: string, to: string, queryable?: Queryable): Promise<PnlResult> {
    const revenueResult = await this.q(queryable).query<{ revenue: string | number }>(
      `SELECT COALESCE(SUM(total - COALESCE(refunded_amount, 0)), 0) as revenue
       FROM sales WHERE created_at::date >= $1::date AND created_at::date <= $2::date`,
      [from, to]
    );

    const cogsResult = await this.q(queryable).query<{ cogs: string | number }>(
      `SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) as cogs
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.created_at::date >= $1::date AND s.created_at::date <= $2::date`,
      [from, to]
    );

    const expensesResult = await this.q(queryable).query(
      `SELECT category, COALESCE(SUM(amount), 0) as total
       FROM expenses WHERE date >= $1 AND date <= $2
       GROUP BY category`,
      [from, to]
    );

    const totalExpensesResult = await this.q(queryable).query<{ total: string | number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= $1 AND date <= $2`,
      [from, to]
    );

    const revenue = Number(revenueResult.rows[0]?.revenue || 0);
    const cogs = Number(cogsResult.rows[0]?.cogs || 0);
    const grossProfit = revenue - cogs;
    const operatingExpenses = Number(totalExpensesResult.rows[0]?.total || 0);
    const netProfit = grossProfit - operatingExpenses;

    return {
      period: { from, to },
      revenue,
      cogs,
      gross_profit: grossProfit,
      operating_expenses: operatingExpenses,
      expenses_by_category: expensesResult.rows,
      net_profit: netProfit,
    };
  }
}

export const expensesRepository = new ExpensesRepository();
