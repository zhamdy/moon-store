import { Queryable } from '../../../database/transaction';
import pool from '../../../database/pool';
import {
  CollectionRecord,
  CollectionProductRecord,
  CollectionFilters,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from './types';

export interface ICollectionsRepository {
  list(filters: CollectionFilters, queryable?: Queryable): Promise<CollectionRecord[]>;
  findById(id: number | string, queryable?: Queryable): Promise<CollectionRecord | null>;
  findProductsByCollectionId(
    collectionId: number | string,
    queryable?: Queryable
  ): Promise<CollectionProductRecord[]>;
  create(data: CreateCollectionDTO, queryable?: Queryable): Promise<CollectionRecord>;
  update(
    id: number | string,
    data: UpdateCollectionDTO,
    queryable?: Queryable
  ): Promise<CollectionRecord | null>;
  deleteProductsByCollectionId(
    collectionId: number | string,
    queryable?: Queryable
  ): Promise<void>;
  addProducts(
    collectionId: number | string,
    productIds: number[],
    queryable?: Queryable
  ): Promise<void>;
  delete(id: number | string, queryable?: Queryable): Promise<boolean>;
}

export class CollectionsRepository implements ICollectionsRepository {
  private defaultQueryable: Queryable = pool;

  private q(queryable?: Queryable): Queryable {
    return queryable || this.defaultQueryable;
  }

  async list(filters: CollectionFilters, queryable?: Queryable): Promise<CollectionRecord[]> {
    const { season, featured } = filters;
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (season) {
      params.push(season);
      where += ` AND c.season = $${params.length}`;
    }
    if (featured === 'true') {
      where += ' AND c.is_featured = 1';
    }

    const collections = await this.q(queryable).query<CollectionRecord>(
      `SELECT c.*,
        (SELECT COUNT(*)::int FROM collection_products WHERE collection_id = c.id) as product_count
       FROM collections c
       ${where}
       ORDER BY c.is_featured DESC, c.created_at DESC`,
      params
    );

    return collections.rows;
  }

  async findById(id: number | string, queryable?: Queryable): Promise<CollectionRecord | null> {
    const res = await this.q(queryable).query<CollectionRecord>(
      'SELECT * FROM collections WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async findProductsByCollectionId(
    collectionId: number | string,
    queryable?: Queryable
  ): Promise<CollectionProductRecord[]> {
    const res = await this.q(queryable).query<CollectionProductRecord>(
      `SELECT p.*, cp.position
       FROM collection_products cp
       JOIN products p ON cp.product_id = p.id
       WHERE cp.collection_id = $1
       ORDER BY cp.position ASC`,
      [collectionId]
    );
    return res.rows;
  }

  async create(data: CreateCollectionDTO, queryable?: Queryable): Promise<CollectionRecord> {
    const res = await this.q(queryable).query<CollectionRecord>(
      `INSERT INTO collections (name, description, season, is_featured)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        data.name,
        data.description || null,
        data.season || null,
        data.is_featured ? 1 : 0,
      ]
    );
    return res.rows[0];
  }

  async update(
    id: number | string,
    data: UpdateCollectionDTO,
    queryable?: Queryable
  ): Promise<CollectionRecord | null> {
    const res = await this.q(queryable).query<CollectionRecord>(
      `UPDATE collections SET name = $1, description = $2, season = $3, is_featured = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [
        data.name,
        data.description || null,
        data.season || null,
        data.is_featured ? 1 : 0,
        id,
      ]
    );
    return res.rows[0] || null;
  }

  async deleteProductsByCollectionId(
    collectionId: number | string,
    queryable?: Queryable
  ): Promise<void> {
    await this.q(queryable).query('DELETE FROM collection_products WHERE collection_id = $1', [
      collectionId,
    ]);
  }

  async addProducts(
    collectionId: number | string,
    productIds: number[],
    queryable?: Queryable
  ): Promise<void> {
    for (let i = 0; i < productIds.length; i++) {
      await this.q(queryable).query(
        `INSERT INTO collection_products (collection_id, product_id, position)
         VALUES ($1, $2, $3)`,
        [collectionId, productIds[i], i]
      );
    }
  }

  async delete(id: number | string, queryable?: Queryable): Promise<boolean> {
    const res = await this.q(queryable).query(
      'DELETE FROM collections WHERE id = $1 RETURNING id',
      [id]
    );
    return res.rows.length > 0;
  }
}

export const collectionsRepository = new CollectionsRepository();
