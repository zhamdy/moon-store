export interface CollectionRecord {
  id: number;
  name: string;
  description?: string | null;
  season?: string | null;
  year?: number | null;
  status: string;
  is_featured: number | boolean;
  product_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface CollectionProductRecord {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  cost_price: number;
  stock: number;
  category?: string | null;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
  image_url?: string | null;
  status: string;
  position: number;
  [key: string]: any;
}

export interface CollectionDetailRecord extends CollectionRecord {
  products: CollectionProductRecord[];
}

export interface CreateCollectionDTO {
  name: string;
  description?: string | null;
  season?: string | null;
  year?: number | null;
  status?: string;
  is_featured?: boolean;
  product_ids?: number[];
}

/**
 * A *partial* update. This DTO is deliberately not `CreateCollectionDTO`.
 *
 * Absent means "leave the stored value alone"; an explicit `null` on a nullable
 * column means "clear it". Sharing the create DTO is what made #78 possible: every
 * field was optional, so an omitted `is_featured` was not a validation error, it was
 * a write of the default � and editing a collection's products un-featured it.
 */
export interface UpdateCollectionDTO {
  name?: string;
  description?: string | null;
  season?: string | null;
  year?: number | null;
  status?: string;
  is_featured?: boolean;
  product_ids?: number[];
  /**
   * The `updated_at` the caller read, echoed back so the write can be refused if the
   * row moved underneath it (#81). Not a column — see {@link COLLECTION_MODIFIED_CODE}.
   *
   * Optional on purpose: absent means "no opinion about the version", and the write
   * behaves exactly as it did before optimistic concurrency existed. A cached PWA
   * client running older code therefore keeps working, the same compatibility posture
   * the `Idempotency-Key` rollout takes.
   */
  expected_updated_at?: string;
}

/** Stable, documented code for a write refused because the row moved under the caller. */
export const COLLECTION_MODIFIED_CODE = 'COLLECTION_MODIFIED';

/**
 * Renders `collections.updated_at` as the version token a client can echo back.
 *
 * This is deliberately `toISOString()` and not a hand-written format: it is the *same
 * call* `res.json()` makes when it serializes the row, because `JSON.stringify` invokes
 * `Date.prototype.toJSON`, which is `toISOString`. So the token compared here is
 * byte-identical to the string the client was given, by construction rather than by two
 * formats being kept in agreement.
 *
 * ## The precision this settles
 *
 * `updated_at` is `timestamptz`, which PostgreSQL keeps to the microsecond, while a JS
 * `Date` — what node-pg parses the column into, and the only thing a JSON client ever
 * sees — holds milliseconds. The sub-millisecond digits are therefore already gone
 * before any client can echo anything back, so the comparison has to happen at
 * millisecond resolution or it could never match at all.
 *
 * The residual is that two writes to one collection landing inside the same millisecond
 * are indistinguishable. Reaching that needs both writes plus a read interleaved between
 * them, and writers to a single collection are serialized by the `FOR UPDATE` in
 * `lockById` — so consecutive writes are separated by a whole transaction commit, which
 * is not a sub-millisecond event on storage that durably persists anything.
 */
export function collectionVersionToken(updatedAt: Date): string {
  return updatedAt.toISOString();
}

/**
 * Thrown when a whole-set replace carries a version token that is no longer current.
 *
 * `PUT /api/v1/collections/:id` replaces the entire product set, so a request computed
 * from a stale read does not merge with what it missed — it erases it. Before this
 * existed the loser of that race got a 200 and their product was simply gone (#81).
 *
 * Deliberately carries no "current" token. The recovery for a conflict is *review* —
 * re-read, look at what changed, decide — and handing the client a fresh token would
 * make blind resubmission the easiest thing to do, which is the silent overwrite this
 * refusal exists to prevent.
 */
export class CollectionConflictError extends Error {
  constructor(
    message: string,
    public readonly code: string = COLLECTION_MODIFIED_CODE,
    public readonly statusCode: number = 409
  ) {
    super(message);
    this.name = 'CollectionConflictError';
  }
}

export interface CollectionFilters {
  season?: string;
  featured?: boolean;
  page: number;
  pageSize: number;
  sortBy: 'createdAt' | 'name';
  sortOrder: 'asc' | 'desc';
}

import { z } from 'zod';
import { createListQuerySchema } from '../../../http/pagination';

const collectionListQuerySchema = createListQuerySchema(['createdAt', 'name'] as const)
  .extend({
    season: z.string().trim().min(1).max(50).optional(),
    featured: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict()
  .transform((query) => ({ sortBy: query.sortBy ?? 'createdAt', ...query }));

export function parseCollectionListQuery(query: unknown): CollectionFilters {
  const parsed = collectionListQuerySchema.parse(query);
  return {
    season: parsed.season,
    featured: parsed.featured,
    page: parsed.page,
    pageSize: parsed.pageSize,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  };
}
