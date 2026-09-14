/**
 * Public catalog types.
 *
 * Row types are exactly the columns the repository names; DTO types are exactly what the
 * public receives. The two are kept apart so a column added to a row cannot reach a
 * response without a mapper change (KD-2).
 */
import type { PaginationMeta } from '../../../http/pagination';
import type { CatalogSort } from './constants';

export type CatalogScope =
  | { kind: 'all' }
  | { kind: 'category'; slug: string }
  | { kind: 'collection'; slug: string }
  | { kind: 'new' };

export interface CatalogProductFilters {
  page: number;
  scope: CatalogScope;
  inStock: boolean;
  priceMin?: number;
  priceMax?: number;
  sort: CatalogSort;
}

/** A listing row. `id` is internal (joins, gallery lookup) and never mapped out. */
export interface CatalogProductRow {
  id: number;
  slug: string;
  name: string;
  name_en: string | null;
  /** NUMERIC: a string from node-postgres, a number from pg-mem. */
  price: string | number;
  image_url: string | null;
  is_new: boolean;
  in_stock: boolean;
}

export interface CatalogGalleryRow {
  product_id: number;
  image_url: string;
}

export interface CatalogCategoryRow {
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  product_count: string | number;
}

export interface CatalogCollectionRow {
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  season: string | null;
  year: string | number | null;
  image_url: string | null;
  is_featured: string | number | boolean | null;
  product_count: string | number;
}

export interface CatalogImageDto {
  url: string;
}

export interface CatalogProductDto {
  slug: string;
  name: string;
  nameEn: string | null;
  price: number;
  images: CatalogImageDto[];
  isNew: boolean;
  inStock: boolean;
}

export interface CatalogCategoryDto {
  slug: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  productCount: number;
}

export interface CatalogCollectionDto {
  slug: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  season: string | null;
  year: number | null;
  imageUrl: string | null;
  isFeatured: boolean;
  productCount: number;
}

export interface CatalogPriceRange {
  min: number | null;
  max: number | null;
}

export interface CatalogProductListMeta {
  pagination: PaginationMeta;
  priceRange: CatalogPriceRange;
}

export interface CatalogProductList {
  data: CatalogProductDto[];
  meta: CatalogProductListMeta;
}
