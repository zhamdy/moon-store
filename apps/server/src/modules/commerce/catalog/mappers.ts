/**
 * Row -> public DTO (KD-2, KD-3).
 *
 * Each mapper names every key it emits, so a column a repository starts selecting cannot
 * reach a response on its own. Numbers are converted here: node-postgres returns NUMERIC
 * and COUNT-derived values as strings, pg-mem returns numbers, and the DTO is a number on
 * both.
 */
import { CATALOG_LIST_IMAGE_COUNT } from './constants';
import type {
  CatalogCategoryDto,
  CatalogCategoryRow,
  CatalogCollectionDto,
  CatalogCollectionRow,
  CatalogImageDto,
  CatalogProductDto,
  CatalogProductRow,
} from './types';

const HTTP_URL = /^https?:\/\//i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A stored image URL made absolute on `origin`.
 *
 * `origin` comes from configuration (`resolveMediaPublicOrigin`), never from the request's
 * Host or X-Forwarded-Host: these responses are publicly cached, so a forged host would
 * poison the cache for every shopper. Absolute http(s) URLs (an object store's) pass
 * through untouched. Anything else that carries a scheme, or is protocol-relative, is
 * dropped rather than handed to a browser.
 */
export function absoluteMediaUrl(stored: string | null | undefined, origin: string): string | null {
  if (typeof stored !== 'string') return null;
  const value = stored.trim();
  if (!value) return null;
  if (HTTP_URL.test(value)) return value;
  if (ANY_SCHEME.test(value) || value.startsWith('//') || value.startsWith('\\')) return null;
  return new URL(value.startsWith('/') ? value : `/${value}`, `${origin}/`).href;
}

function toNumber(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** `[primary, ...gallery by position]`, nulls and unusable URLs removed, capped. */
export function productImages(
  primary: string | null,
  galleryInOrder: readonly string[],
  origin: string
): CatalogImageDto[] {
  const images: CatalogImageDto[] = [];
  for (const candidate of [primary, ...galleryInOrder]) {
    const url = absoluteMediaUrl(candidate, origin);
    if (url) images.push({ url });
    if (images.length === CATALOG_LIST_IMAGE_COUNT) break;
  }
  return images;
}

export function toCatalogProductDto(
  row: CatalogProductRow,
  galleryInOrder: readonly string[],
  origin: string
): CatalogProductDto {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? null,
    price: toNumber(row.price),
    images: productImages(row.image_url, galleryInOrder, origin),
    isNew: row.is_new === true,
    inStock: row.in_stock === true,
  };
}

export function toCatalogCategoryDto(row: CatalogCategoryRow): CatalogCategoryDto {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? null,
    description: row.description ?? null,
    descriptionEn: row.description_en ?? null,
    productCount: toNumber(row.product_count),
  };
}

export function toCatalogCollectionDto(
  row: CatalogCollectionRow,
  origin: string
): CatalogCollectionDto {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? null,
    description: row.description ?? null,
    descriptionEn: row.description_en ?? null,
    season: row.season ?? null,
    year: row.year === null || row.year === undefined ? null : toNumber(row.year),
    imageUrl: absoluteMediaUrl(row.image_url, origin),
    isFeatured: row.is_featured === true || Number(row.is_featured) === 1,
    productCount: toNumber(row.product_count),
  };
}
