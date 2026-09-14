/**
 * The public catalog's request contracts (#102, plan KD-4).
 *
 * Every schema is `.strict()`: an unknown query parameter is a 400, so a typo or a
 * cache-busting junk parameter cannot quietly widen the set of cacheable URLs. No service,
 * repository or database import here (generation runs in CI with no connection).
 */
import { z } from 'zod';
import { defineRequestContract } from '../../../http/requestContracts';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '../../inventory/shared/slug';
import {
  CATALOG_MAX_PAGE,
  CATALOG_PAGE_SIZE,
  CATALOG_PRICE_MAX,
  CATALOG_PRICE_STEP,
  CATALOG_SORTS,
  NEW_IN_DAYS,
} from './constants';
import type { CatalogProductFilters } from './types';

const slugParam = (name: string) =>
  z
    .string()
    .max(SLUG_MAX_LENGTH, `${name} is too long`)
    .regex(SLUG_PATTERN, `${name} must be a lowercase slug`);

const pageParam = z
  .string()
  .regex(/^\d{1,4}$/, 'page must be a whole number')
  .transform(Number)
  .pipe(z.number().int().min(1).max(CATALOG_MAX_PAGE));

const priceParam = (name: string) =>
  z
    .string()
    .regex(/^\d{1,8}$/, `${name} must be a non-negative whole number`)
    .transform(Number)
    .pipe(z.number().int().min(0).max(CATALOG_PRICE_MAX).multipleOf(CATALOG_PRICE_STEP));

/** `true` is the only accepted value: `false` means "absent", and two spellings split caches. */
const trueFlag = z
  .enum(['true'])
  .transform(() => true as const)
  .optional();

export const catalogProductListQuerySchema = z
  .object({
    page: pageParam.optional(),
    category: slugParam('category').optional(),
    collection: slugParam('collection').optional(),
    new: trueFlag,
    inStock: trueFlag,
    priceMin: priceParam('priceMin').optional(),
    priceMax: priceParam('priceMax').optional(),
    sort: z.enum(CATALOG_SORTS).optional(),
  })
  .strict()
  .superRefine((query, ctx) => {
    const scopes = [query.category, query.collection, query.new].filter((v) => v !== undefined);
    if (scopes.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'category, collection and new are mutually exclusive',
      });
    }
    if (query.sort === 'curated' && query.collection === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sort'],
        message: 'sort=curated requires collection',
      });
    }
    if (
      query.priceMin !== undefined &&
      query.priceMax !== undefined &&
      query.priceMin > query.priceMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['priceMin'],
        message: 'priceMin must not exceed priceMax',
      });
    }
  });

export type CatalogProductListQuery = z.infer<typeof catalogProductListQuerySchema>;

/** Defaults live here, not in the schema, so the document shows them as optional on the wire. */
export function normalizeCatalogProductQuery(
  query: CatalogProductListQuery
): CatalogProductFilters {
  const scope: CatalogProductFilters['scope'] =
    query.category !== undefined
      ? { kind: 'category', slug: query.category }
      : query.collection !== undefined
        ? { kind: 'collection', slug: query.collection }
        : query.new
          ? { kind: 'new' }
          : { kind: 'all' };

  return {
    page: query.page ?? 1,
    scope,
    inStock: query.inStock === true,
    priceMin: query.priceMin,
    priceMax: query.priceMax,
    sort: query.sort ?? (scope.kind === 'collection' ? 'curated' : 'newest'),
  };
}

/** No query parameters at all; anything sent is refused rather than ignored. */
export const catalogEmptyQuerySchema = z.object({}).strict();

export const catalogCollectionParamsSchema = z.object({ slug: slugParam('slug') }).strict();

/** Products and collections share one slug grammar. */
export const catalogProductParamsSchema = catalogCollectionParamsSchema;

const PUBLIC_READ =
  'Public and unauthenticated. Rate limited by the catalog limiter, not the global one: ' +
  'per IP, or one shared bucket for a request carrying a valid X-Catalog-Server-Token. ' +
  'A 2xx carries Cache-Control: public, max-age=60; every other status carries no-store.';

export const catalogRequestContracts = {
  listCatalogProducts: defineRequestContract({
    method: 'GET',
    path: '/api/v1/catalog/products',
    operation: 'listCatalogProducts',
    query: catalogProductListQuerySchema,
    noBody: true,
    beyondSchema: [
      PUBLIC_READ,
      'category, collection and new are mutually exclusive (400).',
      'sort=curated requires collection (400); it is the default when collection is present, ' +
        'otherwise the default is newest.',
      `priceMin and priceMax are whole EGP, multiples of ${CATALOG_PRICE_STEP}; ` +
        'priceMin > priceMax is a 400.',
      `The page size is fixed at ${CATALOG_PAGE_SIZE}; page is 1-${CATALOG_MAX_PAGE}. ` +
        'A page past the last returns empty data with correct meta.',
      'Only active products with a slug are listed. newest and price sorts put in-stock ' +
        'products first; curated is pure collection position order.',
      'An unknown category or collection slug, or a collection that is not active or ' +
        'on_sale, is a 404 with one shared body.',
      `isNew is created within the last ${NEW_IN_DAYS} days. meta.priceRange is the scope's ` +
        'price bounds with every filter except priceMin/priceMax applied.',
    ],
  }),

  getCatalogProduct: defineRequestContract({
    method: 'GET',
    path: '/api/v1/catalog/products/{slug}',
    operation: 'getCatalogProduct',
    query: catalogEmptyQuerySchema,
    params: catalogProductParamsSchema,
    noBody: true,
    beyondSchema: [
      PUBLIC_READ,
      'Only an active product with this slug is found. An unknown, inactive or discontinued ' +
        'product is a 404 with a body identical to any other catalog 404.',
      'images: the primary image, then the gallery by position, at most 9.',
      'options and variants come from variant attributes: keys are trimmed and lower-cased, ' +
        'values match case-insensitively (first spelling shown). Only variants carrying the ' +
        'most common key set are listed; malformed or duplicate variants are omitted.',
      'A variant price is its own price, else the product price. inStock is stock > 0; the ' +
        'product is in stock when any listed variant is (own stock for a product without ' +
        'variants). No stock quantity is exposed.',
      `isNew is created within the last ${NEW_IN_DAYS} days. collections lists active and ` +
        'on_sale collections only, featured first.',
    ],
  }),

  listCatalogCategories: defineRequestContract({
    method: 'GET',
    path: '/api/v1/catalog/categories',
    operation: 'listCatalogCategories',
    query: catalogEmptyQuerySchema,
    noBody: true,
    beyondSchema: [
      PUBLIC_READ,
      'Every category with a slug, ordered by name, including those with productCount 0 ' +
        '(active products with a slug only).',
    ],
  }),

  listCatalogCollections: defineRequestContract({
    method: 'GET',
    path: '/api/v1/catalog/collections',
    operation: 'listCatalogCollections',
    query: catalogEmptyQuerySchema,
    noBody: true,
    beyondSchema: [
      PUBLIC_READ,
      'Active and on_sale collections with a slug, featured first, then year (newest, ' +
        'unknown last), then most recently created.',
    ],
  }),

  getCatalogStorePolicies: defineRequestContract({
    method: 'GET',
    path: '/api/v1/catalog/store-policies',
    operation: 'getCatalogStorePolicies',
    query: catalogEmptyQuerySchema,
    noBody: true,
    beyondSchema: [
      PUBLIC_READ,
      'Store-wide delivery and returns copy for the product page, maintained in the dashboard ' +
        'settings. Only the settings delivery_policy, delivery_policy_en, returns_policy and ' +
        'returns_policy_en are read; no other setting is ever exposed.',
      'Each field is the trimmed stored text, or null when the setting is unset, empty or ' +
        'whitespace-only. Always 200.',
    ],
  }),

  getCatalogCollection: defineRequestContract({
    method: 'GET',
    path: '/api/v1/catalog/collections/{slug}',
    operation: 'getCatalogCollection',
    query: catalogEmptyQuerySchema,
    params: catalogCollectionParamsSchema,
    noBody: true,
    beyondSchema: [
      PUBLIC_READ,
      'An unknown, upcoming or archived collection is a 404 with a body identical to any ' +
        'other catalog 404.',
    ],
  }),
} as const;

export const catalogContractList = Object.values(catalogRequestContracts);
