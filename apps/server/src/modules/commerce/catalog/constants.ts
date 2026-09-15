/**
 * Public catalog constants (plan 2026-09-14-002, Unit 4).
 *
 * Dependency-free on purpose: `src/router.ts` mounts the module at `CATALOG_API_PREFIX` and
 * `src/http/rateLimits.ts` builds the global-limiter exemption from the same constant, so
 * the mount and the exemption cannot drift apart. Importing this file must never pull in
 * the database layer.
 */

/** Where the catalog router is mounted. The only spelling of this prefix in the server. */
export const CATALOG_API_PREFIX = '/api/v1/catalog';

/**
 * The "new" window in days (B-7). One constant drives both the `isNew` badge and the
 * `new=true` listing. Interpolated into SQL as a literal (pg-mem cannot multiply an
 * integer parameter by an interval), which is safe only because it is this constant.
 */
export const NEW_IN_DAYS = 30;

if (!Number.isSafeInteger(NEW_IN_DAYS) || NEW_IN_DAYS <= 0) {
  throw new Error('NEW_IN_DAYS must be a positive integer: it is interpolated into SQL');
}

/** Fixed listing page size: divisible by 2, 3 and 4 columns, and not a parameter (KD-4). */
export const CATALOG_PAGE_SIZE = 24;

/** Deepest page a caller may ask for; bounds OFFSET cost and cache-key spread (KD-17). */
export const CATALOG_MAX_PAGE = 500;

/** Price bounds must be whole multiples of this, in EGP (KD-17). */
export const CATALOG_PRICE_STEP = 50;

/** Upper bound on a price filter value, so a query string cannot carry an absurd number. */
export const CATALOG_PRICE_MAX = 10_000_000;

/** At most this many images per product in a listing: the primary and the hover image. */
export const CATALOG_LIST_IMAGE_COUNT = 2;

/**
 * At most this many images on a product detail: the primary plus the dashboard's gallery cap
 * of 8. Enforced here because `product_images` has no database limit.
 */
export const CATALOG_DETAIL_IMAGE_COUNT = 9;

/** `SET LOCAL statement_timeout` for every catalog read transaction (KD-17). */
export const CATALOG_STATEMENT_TIMEOUT_MS = 2000;

/** Collection statuses the public may see. `upcoming` and `archived` are invisible. */
export const PUBLIC_COLLECTION_STATUSES = ['active', 'on_sale'] as const;

/**
 * The only `settings` keys the public may read: store-wide delivery and returns copy for
 * the product page (Arabic primary, `_en` English). Named in SQL, never the whole table,
 * because `settings` also holds tax, loyalty and receipt configuration.
 */
export const STORE_POLICY_SETTING_KEYS = {
  delivery: 'delivery_policy',
  deliveryEn: 'delivery_policy_en',
  returns: 'returns_policy',
  returnsEn: 'returns_policy_en',
} as const;

/** Successful catalog responses may be shared-cached for this long (KD-5). */
export const CATALOG_CACHE_SECONDS = 60;

/**
 * The one NOT_FOUND message every catalog miss uses: unknown category, unknown collection,
 * and a collection that exists but is `upcoming` or `archived`. Identical bodies are what
 * stop a caller probing slugs for unreleased collections.
 */
export const CATALOG_NOT_FOUND_MESSAGE = 'Resource not found';

export const CATALOG_SORTS = ['newest', 'price-asc', 'price-desc', 'curated'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
