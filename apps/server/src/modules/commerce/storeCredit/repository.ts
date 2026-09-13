import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { CreditEntry, CreditSourceType } from './types';

export interface IStoreCreditRepository {
  getBalance(customerId: number, queryable?: Queryable): Promise<number>;
  lockBalance(customerId: number, queryable: Queryable): Promise<number>;
  listEntries(customerId: number, queryable?: Queryable): Promise<CreditEntry[]>;
  addEntry(
    data: {
      customer_id: number;
      delta: number;
      reason: string;
      source_type: CreditSourceType;
      source_id?: string | null;
      created_by?: number | null;
    },
    queryable?: Queryable
  ): Promise<CreditEntry>;
  customerExists(customerId: number, queryable?: Queryable): Promise<boolean>;
}

export class StoreCreditRepository implements IStoreCreditRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  /** The balance is the sum of the entries; there is no separate number to drift. */
  async getBalance(customerId: number, queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query<{ balance: string }>(
      'SELECT COALESCE(SUM(delta), 0) AS balance FROM customer_credit_ledger WHERE customer_id = $1',
      [customerId]
    );
    return Number(res.rows[0]?.balance ?? 0);
  }

  /**
   * Reads the balance with the customer row locked for the rest of the transaction.
   *
   * Spending is a read-then-write -- check the balance covers the amount, then append a
   * negative entry -- and a ledger has no single row to guard the way a stock column
   * does. Two concurrent redemptions would each read the same balance and each append,
   * spending the same credit twice. Locking the customer serializes them, which is the
   * same shape `executeRefund` uses to make its cumulative cap sound.
   */
  async lockBalance(customerId: number, queryable: Queryable): Promise<number> {
    await queryable.query('SELECT id FROM customers WHERE id = $1 FOR UPDATE', [customerId]);
    return this.getBalance(customerId, queryable);
  }

  async listEntries(customerId: number, queryable?: Queryable): Promise<CreditEntry[]> {
    const res = await this.q(queryable).query<CreditEntry>(
      `SELECT id, customer_id, delta, reason, source_type, source_id, created_by, created_at
         FROM customer_credit_ledger
        WHERE customer_id = $1
        ORDER BY id DESC`,
      [customerId]
    );
    return res.rows.map((row) => ({ ...row, delta: Number(row.delta) }));
  }

  async addEntry(
    data: {
      customer_id: number;
      delta: number;
      reason: string;
      source_type: CreditSourceType;
      source_id?: string | null;
      created_by?: number | null;
    },
    queryable?: Queryable
  ): Promise<CreditEntry> {
    const res = await this.q(queryable).query<CreditEntry>(
      `INSERT INTO customer_credit_ledger
         (customer_id, delta, reason, source_type, source_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, customer_id, delta, reason, source_type, source_id, created_by, created_at`,
      [
        data.customer_id,
        data.delta,
        data.reason,
        data.source_type,
        data.source_id ?? null,
        data.created_by ?? null,
      ]
    );
    return { ...res.rows[0], delta: Number(res.rows[0].delta) };
  }

  async customerExists(customerId: number, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query('SELECT 1 FROM customers WHERE id = $1', [
      customerId,
    ]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const storeCreditRepository = new StoreCreditRepository();
