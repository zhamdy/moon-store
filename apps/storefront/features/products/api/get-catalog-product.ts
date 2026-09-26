import 'server-only';
import { cache } from 'react';
import {
  CATALOG_LIST_TIMEOUT_MS,
  CATALOG_REVALIDATE,
  catalogFetch,
  catalogTags,
} from '@/lib/api/catalog';
import { CATALOG_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiError, isApiError } from '@/lib/api/errors';
import type {
  CatalogProductContext,
  CatalogProductDetail,
  CatalogProductOption,
  CatalogProductVariant,
} from '../types/catalog-product-detail';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

// Optional display text: a key an older API does not send yet reads as null instead of
// failing the page (a pre-migration cache entry, or an API rolled back behind the storefront).
const OPTIONAL_TEXT = [
  'description',
  'descriptionEn',
  'material',
  'materialEn',
  'care',
  'careEn',
  'fit',
  'fitEn',
] as const;

function isPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isImage(value: unknown): value is { url: string } {
  return isRecord(value) && typeof value.url === 'string';
}

function isContext(value: unknown): value is CatalogProductContext {
  return (
    isRecord(value) &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    isNullableString(value.nameEn)
  );
}

function isOption(value: unknown): value is CatalogProductOption {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.label === 'string' &&
    Array.isArray(value.values) &&
    value.values.every((v) => typeof v === 'string')
  );
}

function isVariant(value: unknown): value is CatalogProductVariant {
  return (
    isRecord(value) &&
    isRecord(value.options) &&
    Object.values(value.options).every((v) => typeof v === 'string') &&
    isPrice(value.price) &&
    typeof value.inStock === 'boolean'
  );
}

function invalidReason(data: unknown): string | null {
  if (!isRecord(data)) return 'was not an object';
  if (typeof data.slug !== 'string' || typeof data.name !== 'string') return 'had no slug or name';
  if (!isNullableString(data.nameEn)) return 'had an invalid nameEn';
  for (const field of OPTIONAL_TEXT) {
    if (data[field] !== undefined && !isNullableString(data[field])) {
      return `had an invalid ${field}`;
    }
  }
  if (!isPrice(data.price)) return 'had a non-numeric price';
  if (typeof data.isNew !== 'boolean' || typeof data.inStock !== 'boolean') {
    return 'had non-boolean isNew or inStock';
  }
  if (!Array.isArray(data.images) || !data.images.every(isImage)) return 'had invalid images';
  if (data.category !== null && !isContext(data.category)) return 'had an invalid category';
  if (!Array.isArray(data.collections) || !data.collections.every(isContext)) {
    return 'had invalid collections';
  }
  if (!Array.isArray(data.options) || !data.options.every(isOption)) return 'had invalid options';
  if (!Array.isArray(data.variants) || !data.variants.every(isVariant)) {
    return 'had invalid variants';
  }
  return null;
}

/**
 * `null` for NOT_FOUND and for VALIDATION_ERROR (the slug is the only input, so a malformed
 * one is a missing product), so the page can `notFound()`; every other failure rethrows.
 * `cache` shares one read between `generateMetadata` and the page, which is what lets it
 * carry a deadline: the signal opts the fetch out of Next's own memoization (PD-9).
 */
export const getCatalogProduct = cache(
  async (slug: string): Promise<CatalogProductDetail | null> => {
    let data: unknown;
    try {
      ({ data } = await catalogFetch<unknown>(
        CATALOG_ENDPOINTS.product(slug),
        // A product is an entity, and LOW-12: this read had the list's 60s lifetime
        // under a constant named for the entity's 300s, mis-budgeting its own
        // staleness by 5x. The tag is what makes a withdrawal immediate either way.
        CATALOG_REVALIDATE.entity,
        [catalogTags.products, catalogTags.product(slug)],
        { timeoutMs: CATALOG_LIST_TIMEOUT_MS }
      ));
    } catch (error) {
      if (isApiError(error) && (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR')) {
        return null;
      }
      throw error;
    }

    const reason = invalidReason(data);
    if (reason !== null) {
      throw new ApiError({
        status: 200,
        code: 'INVALID_RESPONSE',
        message: `The catalog product ${reason}.`,
      });
    }
    const product = data as Record<string, unknown>;
    for (const field of OPTIONAL_TEXT) product[field] ??= null;
    return product as unknown as CatalogProductDetail;
  }
);
