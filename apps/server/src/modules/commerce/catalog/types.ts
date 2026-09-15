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

/** A product detail row. `id`, `stock` and `has_variants` are internal and never mapped out. */
export interface CatalogProductDetailRow {
  id: number;
  slug: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  material: string | null;
  material_en: string | null;
  care: string | null;
  care_en: string | null;
  fit: string | null;
  fit_en: string | null;
  price: string | number;
  image_url: string | null;
  stock: string | number | null;
  has_variants: string | number | boolean | null;
  is_new: boolean;
  category_slug: string | null;
  category_name: string | null;
  category_name_en: string | null;
}

/** One variant of a detail product. `id` orders and identifies it in logs only. */
export interface CatalogVariantRow {
  id: number;
  /** NUMERIC and nullable: null means the product's price applies. */
  price: string | number | null;
  stock: string | number | null;
  attributes: string | null;
}

export interface CatalogProductCollectionRow {
  slug: string;
  name: string;
  name_en: string | null;
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

export interface CatalogContextDto {
  slug: string;
  name: string;
  nameEn: string | null;
}

export interface CatalogOptionDto {
  key: string;
  label: string;
  values: string[];
}

export interface CatalogVariantDto {
  options: Record<string, string>;
  price: number;
  inStock: boolean;
}

export interface CatalogProductDetailDto {
  slug: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  material: string | null;
  materialEn: string | null;
  care: string | null;
  careEn: string | null;
  fit: string | null;
  fitEn: string | null;
  price: number;
  isNew: boolean;
  inStock: boolean;
  images: CatalogImageDto[];
  category: CatalogContextDto | null;
  collections: CatalogContextDto[];
  options: CatalogOptionDto[];
  variants: CatalogVariantDto[];
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

/** Store-wide product-page copy. Each field is null when unset, empty or whitespace-only. */
export interface CatalogStorePoliciesDto {
  delivery: string | null;
  deliveryEn: string | null;
  returns: string | null;
  returnsEn: string | null;
}

/** A product a quote line names. `id`, `stock` and `has_variants` are internal. */
export interface CatalogQuoteProductRow {
  id: number;
  slug: string;
  name: string;
  name_en: string | null;
  price: string | number;
  stock: string | number | null;
  has_variants: string | number | boolean | null;
  image_url: string | null;
}

/** A variant row of a batched quote read; `product_id` groups it and is never mapped out. */
export interface CatalogQuoteVariantRow extends CatalogVariantRow {
  product_id: number;
}

/** One requested bag line, as the request contract admits it. The request carries no price. */
export interface CartQuoteRequestLine {
  slug: string;
  options: Record<string, string>;
  quantity: number;
}

export type CartQuoteLineStatus =
  | 'ok'
  | 'reduced'
  | 'soldOut'
  | 'variantUnavailable'
  | 'productUnavailable';

export interface CartQuoteProductDto {
  slug: string;
  name: string;
  nameEn: string | null;
  image: CatalogImageDto | null;
}

export interface CartQuoteOptionDto {
  key: string;
  label: string;
  value: string;
}

export interface CartQuoteLineDto {
  index: number;
  slug: string;
  status: CartQuoteLineStatus;
  /** Null only for `productUnavailable`. */
  product: CartQuoteProductDto | null;
  /** Canonical spellings; empty for a no-variant product or an unresolved variant. */
  options: CartQuoteOptionDto[];
  /** The effective price; null when the product or variant is unavailable. */
  unitPrice: number | null;
  requestedQuantity: number;
  /** The allowed quantity; 0 when not purchasable. */
  quantity: number;
  /** `min(stock, MAX_LINE_QUANTITY)`; 0 when not purchasable. The only stock-derived number. */
  maxQuantity: number;
  lineTotal: number;
}

export interface CartQuoteDto {
  lines: CartQuoteLineDto[];
  subtotal: number;
  itemCount: number;
  maxLineQuantity: number;
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
