import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  LayawayPlanRow,
  LayawayItemRow,
  LayawayPaymentRow,
  LayawayItemInput,
  LayawayFilters,
} from './types';

export interface ILayawayRepository {
  createPlan(
    data: {
      plan_number: string;
      customer_id: number;
      total_amount: number;
      deposit_amount: number;
      remaining_balance: number;
      due_date: string;
      notes?: string | null;
      created_by: number;
    },
    queryable: Queryable
  ): Promise<LayawayPlanRow>;
  createPlanItem(planId: number, item: LayawayItemInput, queryable: Queryable): Promise<void>;
  deductVariantStock(variantId: number, quantity: number, queryable: Queryable): Promise<void>;
  deductProductStock(productId: number, quantity: number, queryable: Queryable): Promise<void>;
  createPayment(
    data: {
      plan_id: number;
      amount: number;
      payment_method: string;
      notes?: string | null;
      cashier_id: number;
    },
    queryable: Queryable
  ): Promise<void>;
  listPlans(
    filters: LayawayFilters,
    queryable?: Queryable
  ): Promise<{ rows: LayawayPlanRow[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<LayawayPlanRow | null>;
  findItemsByPlanId(planId: number | string, queryable?: Queryable): Promise<LayawayItemRow[]>;
  findPaymentsByPlanId(
    planId: number | string,
    queryable?: Queryable
  ): Promise<LayawayPaymentRow[]>;
  updatePlanBalance(
    planId: number,
    remainingBalance: number,
    status: string,
    queryable: Queryable
  ): Promise<void>;
  restockVariant(variantId: number, quantity: number, queryable: Queryable): Promise<void>;
  restockProduct(productId: number, quantity: number, queryable: Queryable): Promise<void>;
  updatePlanStatus(planId: number, status: string, queryable: Queryable): Promise<void>;
}

export class LayawayRepository implements ILayawayRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async createPlan(
    data: {
      plan_number: string;
      customer_id: number;
      total_amount: number;
      deposit_amount: number;
      remaining_balance: number;
      due_date: string;
      notes?: string | null;
      created_by: number;
    },
    queryable: Queryable
  ): Promise<LayawayPlanRow> {
    const res = await this.q(queryable).query(
      `INSERT INTO layaway_plans (plan_number, customer_id, total_amount, deposit_amount, remaining_balance, due_date, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8) RETURNING *`,
      [
        data.plan_number,
        data.customer_id,
        data.total_amount,
        data.deposit_amount,
        data.remaining_balance,
        data.due_date,
        data.notes || null,
        data.created_by,
      ]
    );
    return res.rows[0] as unknown as LayawayPlanRow;
  }

  async createPlanItem(
    planId: number,
    item: LayawayItemInput,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO layaway_items (plan_id, product_id, variant_id, quantity, price)
       VALUES ($1, $2, $3, $4, $5)`,
      [planId, item.product_id, item.variant_id || null, item.quantity, item.price]
    );
  }

  async deductVariantStock(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(`UPDATE product_variants SET stock = stock - $1 WHERE id = $2`, [
      quantity,
      variantId,
    ]);
  }

  async deductProductStock(
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`,
      [quantity, productId]
    );
  }

  async createPayment(
    data: {
      plan_id: number;
      amount: number;
      payment_method: string;
      notes?: string | null;
      cashier_id: number;
    },
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO layaway_payments (plan_id, amount, payment_method, notes, cashier_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.plan_id,
        data.amount,
        data.payment_method,
        data.notes || 'Initial deposit',
        data.cashier_id,
      ]
    );
  }

  async listPlans(
    filters: LayawayFilters,
    queryable?: Queryable
  ): Promise<{ rows: LayawayPlanRow[]; total: number }> {
    const { status, page, pageSize, search, sortBy, sortOrder } = filters;
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (status) {
      params.push(status);
      where += ` AND lp.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (lp.plan_number ILIKE $${params.length} OR c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`;
    }

    const countResult = await this.q(queryable).query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM layaway_plans lp
       JOIN customers c ON lp.customer_id = c.id
       ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const sortColumn =
      sortBy === 'dueDate'
        ? 'lp.due_date'
        : sortBy === 'remainingBalance'
          ? 'lp.remaining_balance'
          : 'lp.created_at';

    const res = await this.q(queryable).query(
      `SELECT lp.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
       FROM layaway_plans lp
       JOIN customers c ON lp.customer_id = c.id
       JOIN users u ON lp.created_by = u.id
       ${where}
       ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}, lp.id ${sortOrder.toUpperCase()}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, offset]
    );

    return {
      rows: res.rows as unknown as LayawayPlanRow[],
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<LayawayPlanRow | null> {
    const res = await this.q(queryable).query(
      `SELECT lp.*, c.name as customer_name, c.phone as customer_phone, u.name as created_by_name
       FROM layaway_plans lp
       JOIN customers c ON lp.customer_id = c.id
       JOIN users u ON lp.created_by = u.id
       WHERE lp.id = $1`,
      [id]
    );
    return (res.rows[0] as unknown as LayawayPlanRow) || null;
  }

  async findItemsByPlanId(
    planId: number | string,
    queryable?: Queryable
  ): Promise<LayawayItemRow[]> {
    const res = await this.q(queryable).query(
      `SELECT li.*, p.name as product_name, p.sku
       FROM layaway_items li
       JOIN products p ON li.product_id = p.id
       WHERE li.plan_id = $1`,
      [planId]
    );
    return res.rows as unknown as LayawayItemRow[];
  }

  async findPaymentsByPlanId(
    planId: number | string,
    queryable?: Queryable
  ): Promise<LayawayPaymentRow[]> {
    const res = await this.q(queryable).query(
      `SELECT lp.*, u.name as cashier_name
       FROM layaway_payments lp
       JOIN users u ON lp.cashier_id = u.id
       WHERE lp.plan_id = $1
       ORDER BY lp.created_at ASC`,
      [planId]
    );
    return res.rows as unknown as LayawayPaymentRow[];
  }

  async updatePlanBalance(
    planId: number,
    remainingBalance: number,
    status: string,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `UPDATE layaway_plans SET
         remaining_balance = $1,
         status = $2,
         updated_at = NOW()
       WHERE id = $3`,
      [remainingBalance, status, planId]
    );
  }

  async restockVariant(variantId: number, quantity: number, queryable: Queryable): Promise<void> {
    await this.q(queryable).query(`UPDATE product_variants SET stock = stock + $1 WHERE id = $2`, [
      quantity,
      variantId,
    ]);
  }

  async restockProduct(productId: number, quantity: number, queryable: Queryable): Promise<void> {
    await this.q(queryable).query(
      `UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`,
      [quantity, productId]
    );
  }

  async updatePlanStatus(planId: number, status: string, queryable: Queryable): Promise<void> {
    await this.q(queryable).query(
      `UPDATE layaway_plans SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, planId]
    );
  }
}

export const layawayRepository = new LayawayRepository();
