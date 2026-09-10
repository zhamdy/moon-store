import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import { ReservationRow } from './types';

export interface IReservationsRepository {
  getProductStock(productId: number, queryable?: Queryable): Promise<number>;
  getVariantStock(variantId: number, queryable?: Queryable): Promise<number>;
  getReservedQuantity(
    productId: number,
    variantId?: number | null,
    queryable?: Queryable
  ): Promise<number>;
  createReservation(
    data: {
      product_id: number;
      variant_id?: number | null;
      quantity: number;
      source_type: string;
      source_id?: string | null;
      expiryMinutes: number;
    },
    queryable?: Queryable
  ): Promise<ReservationRow>;
  deleteById(id: number | string, queryable?: Queryable): Promise<boolean>;
  deleteBySourceId(sourceId: string, queryable?: Queryable): Promise<number>;
  deleteBySource(sourceType: string, sourceId: string, queryable?: Queryable): Promise<number>;
  deleteExpired(queryable?: Queryable): Promise<number>;
}

export class ReservationsRepository implements IReservationsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async getProductStock(productId: number, queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query<{ stock: number }>(
      'SELECT stock FROM products WHERE id = $1',
      [productId]
    );
    return Number(res.rows[0]?.stock || 0);
  }

  async getVariantStock(variantId: number, queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query<{ stock: number }>(
      'SELECT stock FROM product_variants WHERE id = $1',
      [variantId]
    );
    return Number(res.rows[0]?.stock || 0);
  }

  async getReservedQuantity(
    productId: number,
    variantId?: number | null,
    queryable?: Queryable
  ): Promise<number> {
    const res = variantId
      ? await this.q(queryable).query<{ total: string | number }>(
          `SELECT COALESCE(SUM(quantity), 0) as total
           FROM stock_reservations
           WHERE product_id = $1 AND variant_id = $2 AND expires_at > NOW()`,
          [productId, variantId]
        )
      : await this.q(queryable).query<{ total: string | number }>(
          `SELECT COALESCE(SUM(quantity), 0) as total
           FROM stock_reservations
           WHERE product_id = $1 AND variant_id IS NULL AND expires_at > NOW()`,
          [productId]
        );

    return Number(res.rows[0]?.total || 0);
  }

  async createReservation(
    data: {
      product_id: number;
      variant_id?: number | null;
      quantity: number;
      source_type: string;
      source_id?: string | null;
      expiryMinutes: number;
    },
    queryable?: Queryable
  ): Promise<ReservationRow> {
    const res = await this.q(queryable).query(
      `INSERT INTO stock_reservations (product_id, variant_id, quantity, source_type, source_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '${data.expiryMinutes} minutes')
       RETURNING *`,
      [
        data.product_id,
        data.variant_id || null,
        data.quantity,
        data.source_type,
        data.source_id || null,
      ]
    );
    return res.rows[0] as unknown as ReservationRow;
  }

  async deleteById(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM stock_reservations WHERE id = $1 RETURNING id',
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async deleteBySourceId(sourceId: string, queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query(
      'DELETE FROM stock_reservations WHERE source_id = $1 RETURNING id',
      [sourceId]
    );
    return res.rowCount || 0;
  }

  /**
   * Releases one source's holds, scoped by what kind of source it is.
   *
   * `deleteBySourceId` keys on the id alone, which is only safe while one kind of thing
   * reserves stock. Online orders reserve under their own numeric id (#137), and cart
   * ids share that space -- so releasing order 7's hold would take cart 7's with it.
   */
  async deleteBySource(
    sourceType: string,
    sourceId: string,
    queryable?: Queryable
  ): Promise<number> {
    const res = await this.q(queryable).query(
      'DELETE FROM stock_reservations WHERE source_type = $1 AND source_id = $2 RETURNING id',
      [sourceType, sourceId]
    );
    return res.rowCount || 0;
  }

  async deleteExpired(queryable?: Queryable): Promise<number> {
    const res = await this.q(queryable).query(
      'DELETE FROM stock_reservations WHERE expires_at <= NOW()'
    );
    return res.rowCount || 0;
  }
}

export const reservationsRepository = new ReservationsRepository();
