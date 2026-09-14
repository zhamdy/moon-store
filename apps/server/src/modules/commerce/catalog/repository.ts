/**
 * Public catalog reads (KD-2, KD-17).
 *
 * NEVER `SELECT *` (or `p.*`) in this file. These rows feed public, shared-cached
 * responses, and `products` carries `cost_price`, supplier and reorder columns; no gate
 * inspects responses, so the whitelist is the column list here plus the mappers. Name
 * every column.
 *
 * Shapes are chosen for both engines. pg-mem cannot resolve correlated subqueries or
 * LATERAL, so variant stock is a grouped LEFT JOIN, and the gallery is one follow-up query
 * for the page's product ids rather than a per-row subquery.
 */
import type { PoolClient } from 'pg';
import { withTransaction, type Queryable } from '../../../database/transaction';
import {
  CATALOG_PAGE_SIZE,
  CATALOG_STATEMENT_TIMEOUT_MS,
  NEW_IN_DAYS,
  PUBLIC_COLLECTION_STATUSES,
} from './constants';
import type {
  CatalogCategoryRow,
  CatalogCollectionRow,
  CatalogGalleryRow,
  CatalogProductCollectionRow,
  CatalogProductDetailRow,
  CatalogProductFilters,
  CatalogProductRow,
  CatalogVariantRow,
} from './types';

/**
 * Runs `fn` in a transaction under `SET LOCAL statement_timeout`, so a pathological query
 * is cancelled (SQLSTATE 57014) instead of pinning a pooled connection. `LOCAL` scopes the
 * setting to this transaction; the connection goes back to the pool unchanged.
 */
export async function withCatalogReadTimeout<T>(
  fn: (client: PoolClient) => Promise<T>,
  timeoutMs: number = CATALOG_STATEMENT_TIMEOUT_MS
): Promise<T> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    // Interpolated into SQL below (SET takes no bind parameters), so it must be an integer.
    throw new Error('catalog statement timeout must be a positive integer of milliseconds');
  }
  return withTransaction(async (client) => {
    await client.query(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);
    return fn(client);
  });
}

/** What a listing is resolved to once slugs are ids. */
export interface ResolvedProductQuery {
  filters: CatalogProductFilters;
  categoryId?: number;
  collectionId?: number;
}

interface BuiltQuery {
  /** The scoped rows, before the in-stock and price filters. */
  scoped: string;
  params: unknown[];
}

const NEW_WINDOW_SQL = `p.created_at >= NOW() - INTERVAL '${NEW_IN_DAYS} days'`;

/**
 * `has_variants = 1` is set when a variant is created and cleared when the last one is
 * deleted (`services/productService.ts`), so it is the authority on which stock counts.
 */
const IN_STOCK_SQL = `(CASE WHEN p.has_variants = 1 THEN COALESCE(vs.stock_sum, 0) > 0 ELSE p.stock > 0 END)`;

function buildScoped(resolved: ResolvedProductQuery): BuiltQuery {
  const params: unknown[] = [];
  const where: string[] = [`p.status = 'active'`, 'p.slug IS NOT NULL'];
  let join = '';
  let positionColumn = '';

  if (resolved.collectionId !== undefined) {
    params.push(resolved.collectionId);
    join = `JOIN collection_products cp ON cp.product_id = p.id AND cp.collection_id = $${params.length}`;
    positionColumn = ', cp.position AS position';
  }
  if (resolved.categoryId !== undefined) {
    params.push(resolved.categoryId);
    where.push(`p.category_id = $${params.length}`);
  }
  if (resolved.filters.scope.kind === 'new') {
    where.push(NEW_WINDOW_SQL);
  }

  const scoped = `SELECT p.id, p.slug, p.name, p.name_en, p.price, p.image_url, p.created_at${positionColumn},
            (${NEW_WINDOW_SQL}) AS is_new,
            ${IN_STOCK_SQL} AS in_stock
       FROM products p
       ${join}
       LEFT JOIN (SELECT product_id, SUM(stock) AS stock_sum
                    FROM product_variants
                   GROUP BY product_id) vs ON vs.product_id = p.id
      WHERE ${where.join(' AND ')}`;

  return { scoped, params };
}

function priceConditions(filters: CatalogProductFilters, params: unknown[]): string[] {
  const conditions: string[] = [];
  if (filters.priceMin !== undefined) {
    params.push(filters.priceMin);
    conditions.push(`s.price >= $${params.length}`);
  }
  if (filters.priceMax !== undefined) {
    params.push(filters.priceMax);
    conditions.push(`s.price <= $${params.length}`);
  }
  return conditions;
}

function orderBy(filters: CatalogProductFilters): string {
  switch (filters.sort) {
    case 'curated':
      return 's.position ASC, s.id ASC';
    case 'price-asc':
      return 's.in_stock DESC, s.price ASC, s.id ASC';
    case 'price-desc':
      return 's.in_stock DESC, s.price DESC, s.id ASC';
    case 'newest':
    default:
      return 's.in_stock DESC, s.created_at DESC NULLS LAST, s.id ASC';
  }
}

export class CatalogRepository {
  async findCategoryIdBySlug(slug: string, db: Queryable): Promise<number | null> {
    const { rows } = await db.query<{ id: number }>(
      'SELECT c.id FROM categories c WHERE c.slug = $1',
      [slug]
    );
    return rows[0]?.id ?? null;
  }

  async findPublicCollectionIdBySlug(slug: string, db: Queryable): Promise<number | null> {
    const { rows } = await db.query<{ id: number }>(
      `SELECT c.id FROM collections c WHERE c.slug = $1 AND c.status IN (${statusList()})`,
      [slug]
    );
    return rows[0]?.id ?? null;
  }

  /**
   * Count (with every filter) and price bounds (with every filter except price), in one
   * aggregate over the same scoped rows.
   */
  async aggregateProducts(
    resolved: ResolvedProductQuery,
    db: Queryable
  ): Promise<{ total: number; minPrice: number | null; maxPrice: number | null }> {
    const { scoped, params } = buildScoped(resolved);
    const stock = resolved.filters.inStock ? 'WHERE s.in_stock' : '';
    const price = priceConditions(resolved.filters, params);
    const counted = price.length > 0 ? price.join(' AND ') : 'TRUE';

    const { rows } = await db.query<{
      total: string | number | null;
      min_price: string | number | null;
      max_price: string | number | null;
    }>(
      `SELECT SUM(CASE WHEN ${counted} THEN 1 ELSE 0 END) AS total,
              MIN(s.price) AS min_price,
              MAX(s.price) AS max_price
         FROM (${scoped}) s
         ${stock}`,
      params
    );
    const row = rows[0];
    const asNumber = (v: string | number | null | undefined) =>
      v === null || v === undefined ? null : Number(v);
    return {
      total: Number(row?.total ?? 0),
      minPrice: asNumber(row?.min_price),
      maxPrice: asNumber(row?.max_price),
    };
  }

  async listProductPage(
    resolved: ResolvedProductQuery,
    db: Queryable
  ): Promise<CatalogProductRow[]> {
    const { scoped, params } = buildScoped(resolved);
    const conditions = [
      ...(resolved.filters.inStock ? ['s.in_stock'] : []),
      ...priceConditions(resolved.filters, params),
    ];
    params.push(CATALOG_PAGE_SIZE, (resolved.filters.page - 1) * CATALOG_PAGE_SIZE);

    const { rows } = await db.query<CatalogProductRow>(
      `SELECT s.id, s.slug, s.name, s.name_en, s.price, s.image_url, s.is_new, s.in_stock
         FROM (${scoped}) s
         ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY ${orderBy(resolved.filters)}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows;
  }

  /**
   * One public product by slug. Equality on `slug` already excludes a null slug, and keeps
   * this query clear of the pg-mem `slug IS NOT NULL` shim.
   */
  async findPublicProductBySlug(
    slug: string,
    db: Queryable
  ): Promise<CatalogProductDetailRow | null> {
    const { rows } = await db.query<CatalogProductDetailRow>(
      `SELECT p.id, p.slug, p.name, p.name_en, p.description, p.description_en, p.price,
              p.material, p.material_en, p.care, p.care_en, p.fit, p.fit_en,
              p.image_url, p.stock, p.has_variants,
              (${NEW_WINDOW_SQL}) AS is_new,
              c.slug AS category_slug, c.name AS category_name, c.name_en AS category_name_en
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.slug = $1 AND p.status = 'active'`,
      [slug]
    );
    return rows[0] ?? null;
  }

  /** Creation order is display order. */
  async listVariants(productId: number, db: Queryable): Promise<CatalogVariantRow[]> {
    const { rows } = await db.query<CatalogVariantRow>(
      `SELECT v.id, v.price, v.stock, v.attributes
         FROM product_variants v
        WHERE v.product_id = $1
        ORDER BY v.id ASC`,
      [productId]
    );
    return rows;
  }

  /** The product's public collections, in `listCollections` order. */
  async listProductCollections(
    productId: number,
    db: Queryable
  ): Promise<CatalogProductCollectionRow[]> {
    const { rows } = await db.query<CatalogProductCollectionRow>(
      `SELECT c.slug, c.name, c.name_en
         FROM collection_products cp
         JOIN collections c ON c.id = cp.collection_id
        WHERE cp.product_id = $1 AND c.slug IS NOT NULL AND c.status IN (${statusList()})
        ORDER BY COALESCE(c.is_featured, 0) DESC, c.year DESC NULLS LAST,
                 c.created_at DESC NULLS LAST, c.id ASC`,
      [productId]
    );
    return rows;
  }

  /** Gallery URLs for a page of products, in position order. At most 8 per product. */
  async listGallery(productIds: readonly number[], db: Queryable): Promise<CatalogGalleryRow[]> {
    if (productIds.length === 0) return [];
    const { rows } = await db.query<CatalogGalleryRow>(
      `SELECT pi.product_id, pi.image_url
         FROM product_images pi
        WHERE pi.product_id = ANY($1::int[])
        ORDER BY pi.product_id ASC, pi.position ASC`,
      [productIds]
    );
    return rows;
  }

  async listCategories(db: Queryable): Promise<CatalogCategoryRow[]> {
    const { rows } = await db.query<CatalogCategoryRow>(
      `SELECT c.slug, c.name, c.name_en, c.description, c.description_en,
              COALESCE(pc.product_count, 0) AS product_count
         FROM categories c
         LEFT JOIN (SELECT p.category_id, COUNT(*)::int AS product_count
                      FROM products p
                     WHERE p.status = 'active' AND p.slug IS NOT NULL
                     GROUP BY p.category_id) pc ON pc.category_id = c.id
        WHERE c.slug IS NOT NULL
        ORDER BY c.name ASC, c.id ASC`
    );
    return rows;
  }

  async listCollections(db: Queryable, slug?: string): Promise<CatalogCollectionRow[]> {
    const params: unknown[] = [];
    let bySlug = '';
    if (slug !== undefined) {
      params.push(slug);
      bySlug = `AND c.slug = $${params.length}`;
    }
    const { rows } = await db.query<CatalogCollectionRow>(
      `SELECT c.slug, c.name, c.name_en, c.description, c.description_en, c.season, c.year,
              c.image_url, c.is_featured,
              COALESCE(pc.product_count, 0) AS product_count
         FROM collections c
         LEFT JOIN (SELECT cp.collection_id, COUNT(*)::int AS product_count
                      FROM collection_products cp
                      JOIN products p ON p.id = cp.product_id
                     WHERE p.status = 'active' AND p.slug IS NOT NULL
                     GROUP BY cp.collection_id) pc ON pc.collection_id = c.id
        WHERE c.slug IS NOT NULL AND c.status IN (${statusList()}) ${bySlug}
        ORDER BY COALESCE(c.is_featured, 0) DESC, c.year DESC NULLS LAST,
                 c.created_at DESC NULLS LAST, c.id ASC`,
      params
    );
    return rows;
  }
}

/** A constant list of literals, never input. */
function statusList(): string {
  return PUBLIC_COLLECTION_STATUSES.map((status) => `'${status}'`).join(', ');
}

export const catalogRepository = new CatalogRepository();
