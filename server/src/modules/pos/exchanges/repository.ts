import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  ExchangeRow,
  ReturnedItemRow,
  NewItemRow,
  ReturnedItemInput,
  NewItemInput,
} from './types';

export interface IExchangesRepository {
  findSaleById(saleId: number, queryable?: Queryable): Promise<Record<string, any> | null>;
  createExchange(
    data: {
      exchange_number: string;
      original_sale_id: number;
      customer_id: number | null;
      cashier_id: number;
      return_total: number;
      new_total: number;
      difference: number;
      payment_method: string;
      notes?: string | null;
    },
    queryable: Queryable
  ): Promise<ExchangeRow>;
  createReturnedItem(
    exchangeId: number,
    item: ReturnedItemInput,
    queryable: Queryable
  ): Promise<void>;
  createNewItem(exchangeId: number, item: NewItemInput, queryable: Queryable): Promise<void>;
  restockVariant(variantId: number, quantity: number, queryable: Queryable): Promise<void>;
  restockProduct(productId: number, quantity: number, queryable: Queryable): Promise<void>;
  deductVariantStock(variantId: number, quantity: number, queryable: Queryable): Promise<void>;
  deductProductStock(productId: number, quantity: number, queryable: Queryable): Promise<void>;
  listExchanges(
    filters: { search?: string; limit: number; offset: number },
    queryable?: Queryable
  ): Promise<{ rows: ExchangeRow[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<ExchangeRow | null>;
  findReturnedItems(
    exchangeId: number | string,
    queryable?: Queryable
  ): Promise<ReturnedItemRow[]>;
  findNewItems(exchangeId: number | string, queryable?: Queryable): Promise<NewItemRow[]>;
}

export class ExchangesRepository implements IExchangesRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async findSaleById(saleId: number, queryable?: Queryable): Promise<Record<string, any> | null> {
    const res = await this.q(queryable).query('SELECT * FROM sales WHERE id = $1', [saleId]);
    return res.rows[0] || null;
  }

  async createExchange(
    data: {
      exchange_number: string;
      original_sale_id: number;
      customer_id: number | null;
      cashier_id: number;
      return_total: number;
      new_total: number;
      difference: number;
      payment_method: string;
      notes?: string | null;
    },
    queryable: Queryable
  ): Promise<ExchangeRow> {
    const res = await this.q(queryable).query(
      `INSERT INTO exchanges (exchange_number, original_sale_id, customer_id, cashier_id, return_total, new_total, difference, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.exchange_number,
        data.original_sale_id,
        data.customer_id,
        data.cashier_id,
        data.return_total,
        data.new_total,
        data.difference,
        data.payment_method,
        data.notes || null,
      ]
    );
    return res.rows[0] as unknown as ExchangeRow;
  }

  async createReturnedItem(
    exchangeId: number,
    item: ReturnedItemInput,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO exchange_returned_items (exchange_id, product_id, variant_id, quantity, price, reason, condition)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        exchangeId,
        item.product_id,
        item.variant_id || null,
        item.quantity,
        item.price,
        item.reason,
        item.condition || 'good',
      ]
    );
  }

  async createNewItem(
    exchangeId: number,
    item: NewItemInput,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO exchange_new_items (exchange_id, product_id, variant_id, quantity, price)
       VALUES ($1, $2, $3, $4, $5)`,
      [exchangeId, item.product_id, item.variant_id || null, item.quantity, item.price]
    );
  }

  async restockVariant(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `UPDATE product_variants SET stock = stock + $1 WHERE id = $2`,
      [quantity, variantId]
    );
  }

  async restockProduct(
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2`,
      [quantity, productId]
    );
  }

  async deductVariantStock(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<void> {
    await this.q(queryable).query(
      `UPDATE product_variants SET stock = stock - $1 WHERE id = $2`,
      [quantity, variantId]
    );
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

  async listExchanges(
    filters: { search?: string; limit: number; offset: number },
    queryable?: Queryable
  ): Promise<{ rows: ExchangeRow[]; total: number }> {
    const { search, limit, offset } = filters;
    const params: unknown[] = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE e.exchange_number ILIKE $${params.length}`;
    }

    const countResult = await this.q(queryable).query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM exchanges e ${where}`,
      params
    );

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const res = await this.q(queryable).query(
      `SELECT e.*, u.name as cashier_name, c.name as customer_name
       FROM exchanges e
       JOIN users u ON e.cashier_id = u.id
       LEFT JOIN customers c ON e.customer_id = c.id
       ${where}
       ORDER BY e.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limit, offset]
    );

    return {
      rows: res.rows as unknown as ExchangeRow[],
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async findById(id: number | string, queryable?: Queryable): Promise<ExchangeRow | null> {
    const res = await this.q(queryable).query(
      `SELECT e.*, u.name as cashier_name, c.name as customer_name, s.receipt_number as original_receipt
       FROM exchanges e
       JOIN users u ON e.cashier_id = u.id
       LEFT JOIN customers c ON e.customer_id = c.id
       LEFT JOIN sales s ON e.original_sale_id = s.id
       WHERE e.id = $1`,
      [id]
    );
    return (res.rows[0] as unknown as ExchangeRow) || null;
  }

  async findReturnedItems(
    exchangeId: number | string,
    queryable?: Queryable
  ): Promise<ReturnedItemRow[]> {
    const res = await this.q(queryable).query(
      `SELECT eri.*, p.name as product_name, p.sku
       FROM exchange_returned_items eri
       JOIN products p ON eri.product_id = p.id
       WHERE eri.exchange_id = $1`,
      [exchangeId]
    );
    return res.rows as unknown as ReturnedItemRow[];
  }

  async findNewItems(
    exchangeId: number | string,
    queryable?: Queryable
  ): Promise<NewItemRow[]> {
    const res = await this.q(queryable).query(
      `SELECT eni.*, p.name as product_name, p.sku
       FROM exchange_new_items eni
       JOIN products p ON eni.product_id = p.id
       WHERE eni.exchange_id = $1`,
      [exchangeId]
    );
    return res.rows as unknown as NewItemRow[];
  }
}

export const exchangesRepository = new ExchangesRepository();
