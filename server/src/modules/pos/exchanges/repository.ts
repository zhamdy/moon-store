import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { ExchangeRow, ReturnedItemRow, NewItemRow, ReturnedItemInput, NewItemInput } from './types';

/** Just the sale columns an exchange needs; the row carries more. */
export interface SaleRow {
  id: number;
  customer_id: number | null;
}

/** A line of the original sale: what may come back, and what it is worth. */
export interface SaleItemRow {
  product_id: number;
  variant_id: number | null;
  quantity: number;
  unit_price: string | number;
  product_name: string;
}

export interface IExchangesRepository {
  findSaleById(saleId: number, queryable?: Queryable): Promise<Record<string, any> | null>;
  findSaleByIdForUpdate(saleId: number, queryable: Queryable): Promise<SaleRow | null>;
  findSaleItems(saleId: number, queryable?: Queryable): Promise<SaleItemRow[]>;
  findReturnedQuantitiesBySaleId(
    saleId: number,
    queryable?: Queryable
  ): Promise<Array<{ product_id: number; variant_id: number | null; quantity: number }>>;
  findRefundedQuantitiesBySaleId(
    saleId: number,
    queryable?: Queryable
  ): Promise<Array<{ product_id: number; variant_id: number | null; quantity: number }>>;
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
  deductVariantStock(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null>;
  deductProductStock(
    productId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null>;
  getProductStock(productId: number, queryable: Queryable): Promise<number | null>;
  getVariantStock(variantId: number, queryable: Queryable): Promise<number | null>;
  listExchanges(
    filters: {
      search?: string;
      sortBy: 'createdAt' | 'exchangeNumber' | 'difference';
      sortOrder: 'asc' | 'desc';
      limit: number;
      offset: number;
    },
    queryable?: Queryable
  ): Promise<{ rows: ExchangeRow[]; total: number }>;
  findById(id: number | string, queryable?: Queryable): Promise<ExchangeRow | null>;
  findReturnedItems(exchangeId: number | string, queryable?: Queryable): Promise<ReturnedItemRow[]>;
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

  /**
   * Locks the sale for the rest of the transaction, so the cumulative check below spans
   * sibling exchanges AND concurrent refunds of the same lines rather than racing them.
   * Mirrors `SalesRepository.findByIdForUpdate`, which the refund path already uses.
   */
  async findSaleByIdForUpdate(saleId: number, queryable: Queryable): Promise<SaleRow | null> {
    const res = await this.q(queryable).query<SaleRow>(
      'SELECT * FROM sales WHERE id = $1 FOR UPDATE',
      [saleId]
    );
    return res.rows[0] || null;
  }

  /** The lines the sale actually sold: what may be returned, and what it is worth. */
  async findSaleItems(saleId: number, queryable?: Queryable): Promise<SaleItemRow[]> {
    const res = await this.q(queryable).query<SaleItemRow>(
      `SELECT si.product_id, si.variant_id, si.quantity, si.unit_price, p.name AS product_name
         FROM sale_items si JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = $1`,
      [saleId]
    );
    return res.rows;
  }

  /** How much of each line earlier exchanges against this sale already took back. */
  async findReturnedQuantitiesBySaleId(
    saleId: number,
    queryable?: Queryable
  ): Promise<Array<{ product_id: number; variant_id: number | null; quantity: number }>> {
    const res = await this.q(queryable).query<{
      product_id: number;
      variant_id: number | null;
      quantity: string;
    }>(
      `SELECT eri.product_id, eri.variant_id, SUM(eri.quantity)::int AS quantity
         FROM exchange_returned_items eri
         JOIN exchanges e ON eri.exchange_id = e.id
        WHERE e.original_sale_id = $1
        GROUP BY eri.product_id, eri.variant_id`,
      [saleId]
    );
    return res.rows.map((row) => ({
      product_id: row.product_id,
      variant_id: row.variant_id,
      quantity: Number(row.quantity),
    }));
  }

  /**
   * Prior refunds of the same sale. #122 notes the double-recovery path between the two
   * routes: capping only exchanges would still let a line be refunded and then exchanged.
   * `refunds.items` is a TEXT column holding JSON, so it is parsed here at the boundary.
   */
  async findRefundedQuantitiesBySaleId(
    saleId: number,
    queryable?: Queryable
  ): Promise<Array<{ product_id: number; variant_id: number | null; quantity: number }>> {
    const res = await this.q(queryable).query<{ items: string | unknown }>(
      'SELECT items FROM refunds WHERE sale_id = $1',
      [saleId]
    );

    const totals: Array<{ product_id: number; variant_id: number | null; quantity: number }> = [];
    for (const row of res.rows) {
      const items = (
        typeof row.items === 'string' ? JSON.parse(row.items) : (row.items ?? [])
      ) as Array<{ product_id: number; variant_id?: number | null; quantity: number }>;
      for (const item of items) {
        totals.push({
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
          quantity: Number(item.quantity),
        });
      }
    }
    return totals;
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

  async createNewItem(exchangeId: number, item: NewItemInput, queryable: Queryable): Promise<void> {
    await this.q(queryable).query(
      `INSERT INTO exchange_new_items (exchange_id, product_id, variant_id, quantity, price)
       VALUES ($1, $2, $3, $4, $5)`,
      [exchangeId, item.product_id, item.variant_id || null, item.quantity, item.price]
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

  /**
   * `AND stock >= $1::int` is what stops an exchange driving stock negative; without it
   * the relative write was atomic but unbounded. `$1::int` is cast because pg-mem
   * evaluates `column - $param` with the operands inverted unless the parameter is typed
   * — which is why the unguarded subtraction here never misbehaved on the addition side.
   *
   * @returns the remaining stock, or null when there was not enough.
   */
  async deductVariantStock(
    variantId: number,
    quantity: number,
    queryable: Queryable
  ): Promise<number | null> {
    const res = await this.q(queryable).query<{ stock: number }>(
      `UPDATE product_variants SET stock = stock - $1::int
        WHERE id = $2 AND stock >= $1::int
        RETURNING stock`,
      [quantity, variantId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
  }

  /** @returns the remaining stock, or null when there was not enough. */
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

  /**
   * Reads stock without taking it, for the refusal path only: the guarded UPDATEs above
   * return nothing when they match no row, so how much was actually there has to be
   * asked for separately.
   *
   * @returns the current stock, or null when the row no longer exists.
   */
  async getProductStock(productId: number, queryable: Queryable): Promise<number | null> {
    const res = await this.q(queryable).query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
  }

  /** Variant counterpart of {@link getProductStock}. */
  async getVariantStock(variantId: number, queryable: Queryable): Promise<number | null> {
    const res = await this.q(queryable).query<{ stock: number }>(
      'SELECT stock FROM product_variants WHERE id = $1',
      [variantId]
    );
    return res.rows[0] ? Number(res.rows[0].stock) : null;
  }

  async listExchanges(
    filters: {
      search?: string;
      sortBy: 'createdAt' | 'exchangeNumber' | 'difference';
      sortOrder: 'asc' | 'desc';
      limit: number;
      offset: number;
    },
    queryable?: Queryable
  ): Promise<{ rows: ExchangeRow[]; total: number }> {
    const { search, sortBy, sortOrder, limit, offset } = filters;
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
    const sortColumn =
      sortBy === 'exchangeNumber'
        ? 'e.exchange_number'
        : sortBy === 'difference'
          ? 'e.difference'
          : 'e.created_at';

    const res = await this.q(queryable).query(
      `SELECT e.*, u.name as cashier_name, c.name as customer_name
       FROM exchanges e
       JOIN users u ON e.cashier_id = u.id
       LEFT JOIN customers c ON e.customer_id = c.id
       ${where}
       ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}, e.id ${sortOrder.toUpperCase()}
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

  async findNewItems(exchangeId: number | string, queryable?: Queryable): Promise<NewItemRow[]> {
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
