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
  deductVariantStock(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null>;
  getVariantStock(variantId: number, queryable: Queryable): Promise<number | null>;
  deductProductStock(
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null>;
  getProductStock(productId: number, queryable: Queryable): Promise<number | null>;
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
  decrementPlanBalance(
    planId: number,
    amount: number,
    queryable: Queryable
  ): Promise<number | null>;
  cancelActivePlan(planId: number, queryable: Queryable): Promise<boolean>;
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

  /** Variant counterpart of {@link deductProductStock}, guarded for the same reason. */
  async deductVariantStock(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null> {
    const res = await this.q(queryable).query<{ stock: number }>(
      `UPDATE product_variants SET stock = stock - $1::int, updated_at = NOW()
        WHERE id = $2 AND stock >= $1::int
        RETURNING stock`,
      [quantity, variantId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
  }

  /** Reads variant stock without taking it, for the refusal path. */
  async getVariantStock(variantId: number, queryable: Queryable): Promise<number | null> {
    const res = await this.q(queryable).query<{ stock: number }>(
      'SELECT stock FROM product_variants WHERE id = $1',
      [variantId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
  }

  /**
   * Guarded relative decrement, the shape every stock write in this repo now takes.
   * Unguarded, creating a plan for more units than exist drove stock negative or tripped
   * migration 004's non-negative CHECK and surfaced as a 500 (#127).
   *
   * @returns the resulting stock, or null when there was not enough (or no such row).
   */
  async deductProductStock(
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null> {
    const res = await this.q(queryable).query<{ stock: number }>(
      `UPDATE products SET stock = stock - $1::int, updated_at = NOW()
        WHERE id = $2 AND stock >= $1::int
        RETURNING stock`,
      [quantity, productId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
  }

  /** Reads stock without taking it, to tell "no such product" from "not enough". */
  async getProductStock(productId: number, queryable: Queryable): Promise<number | null> {
    const res = await this.q(queryable).query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
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

  /**
   * Takes `amount` off the balance of an ACTIVE plan that still owes at least that much,
   * in one statement (#127).
   *
   * The balance used to be read outside the transaction, reduced in JavaScript and
   * written back as an absolute value, which loses an update: two installments both read
   * 800, both wrote 400, and one customer's payment stopped existing on the plan while
   * its payment row stayed on the books. Folding both the status and the sufficiency test
   * into the WHERE clause removes the stale-read window -- under READ COMMITTED
   * PostgreSQL re-evaluates them after the other writer's row lock is released -- and
   * makes a payment racing a cancellation refuse instead of applying to a dead plan.
   *
   * `$1::numeric` is cast explicitly: pg-mem evaluates `column - $param` with the operands
   * inverted unless the parameter is typed, which would turn the decrement into a negation.
   *
   * @returns the resulting balance, or null when the plan is not active or owes less.
   */
  async decrementPlanBalance(
    planId: number,
    amount: number,
    queryable: Queryable
  ): Promise<number | null> {
    const res = await this.q(queryable).query<{ remaining_balance: string }>(
      `UPDATE layaway_plans
          SET remaining_balance = remaining_balance - $1::numeric,
              updated_at = NOW()
        WHERE id = $2 AND status = 'active' AND remaining_balance >= $1::numeric
        RETURNING remaining_balance`,
      [amount, planId]
    );
    return res.rows[0] ? Number(res.rows[0].remaining_balance) : null;
  }

  /**
   * Cancels an active plan in one statement, so a cancellation racing a payment is
   * decided by the database rather than by which caller read the row first.
   *
   * @returns true when this call is the one that cancelled it.
   */
  async cancelActivePlan(planId: number, queryable: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      `UPDATE layaway_plans SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND status = 'active'
        RETURNING id`,
      [planId]
    );
    return res.rows.length > 0;
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
