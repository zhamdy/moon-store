// Types owned by the inventory slice. Cross-slice contracts (Product,
// Category, Distributor, ProductVariant, ...) live in `shared/types` instead.

import type { Product } from '../../shared/types';

/**
 * A row from GET products/low-stock: a product plus how far under its floor it
 * sits. The server computes the deficit, so the client never has to guess which
 * of two subtractions it meant.
 */
export interface LowStockProduct extends Product {
  deficit: number;
}

/** One parsed line of the CSV the inventory page imports. */
export interface CsvProduct {
  name: string;
  sku: string;
  barcode: string;
  price: number;
  cost_price: number;
  stock: number;
  category: string;
  min_stock: number;
}

/** What POST products/import reports back, per file. */
export interface ProductImportResult {
  imported: number;
  errors: Array<{ row: number; error: string }>;
}

/** What POST products/bulk-delete reports back. */
export interface BulkDiscontinueResult {
  deleted: number;
}

/** Write payload for POST /api/products and PUT /api/products/:id */
export interface ProductFormData {
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost_price: number;
  stock: number;
  category_id?: number | null;
  distributor_id?: number | null;
  min_stock: number;
  /** Blank in the form; omitted on the wire so the server generates or keeps one. */
  slug?: string;
  /** Blank in the form; sent as null, which clears it. Arabic `name` stays primary. */
  name_en?: string | null;
  /** Same blank-clears convention as `name_en`. Arabic `description` stays primary. */
  description?: string | null;
  description_en?: string | null;
}

/** One additional image from GET products/:id/images, ordered by `position`. */
export interface ProductImage {
  id: number;
  product_id: number;
  image_url: string;
  position: number;
  created_at: string;
}

/**
 * Category row from GET /api/categories — the collection's own full shape.
 * Deliberately separate from `Category`, which is the trimmed projection the
 * product routes hand out.
 */
export interface CategoryRecord {
  id: number;
  name: string;
  code: string;
  slug?: string | null;
  name_en?: string | null;
  description_en?: string | null;
  created_at: string;
  updated_at: string;
}

/** Collection row from GET /api/collections */
export interface Collection {
  id: number;
  name: string;
  season: string | null;
  year: number | null;
  status: string;
  description: string | null;
  slug?: string | null;
  name_en?: string | null;
  description_en?: string | null;
  /** Set only through POST/DELETE collections/:id/image, which leave `updated_at` alone. */
  image_url?: string | null;
  product_count: number;
  /**
   * Doubles as the optimistic-concurrency token (#81). Echoed back as
   * `expected_updated_at` on a write, which the server refuses if the row has moved
   * since — `PUT` replaces the whole product set, so a write from a stale read erases
   * whatever it did not know about rather than merging with it.
   */
  updated_at: string;
}

/**
 * A product as the collection detail endpoint projects it — fewer columns than
 * `Product`, since a collection only shows what it takes to identify a line.
 */
export interface CollectionProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
  image_url: string | null;
}

/** GET /api/collections/:id — the list row plus the products it holds */
export interface CollectionDetail extends Collection {
  products: CollectionProduct[];
}

/** One product line inside a bundle */
export interface BundleItem {
  id?: number;
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
}

/** Bundle from GET /api/bundles, and from GET /api/bundles/:id */
export interface Bundle {
  id: number;
  name: string;
  description: string | null;
  price: number;
  status: string;
  items: BundleItem[];
  original_price: number;
  savings: number;
  savings_percent: number;
  created_at: string;
}

/** A stock count row from GET /api/v1/stock-counts, with its progress totals. */
export interface StockCountSummary {
  id: number;
  status: string;
  category_name: string | null;
  notes: string | null;
  started_by_name: string;
  started_at: string;
  item_count: number;
  counted: number;
}

/** One product being counted, from GET /api/v1/stock-counts/:id. */
export interface StockCountItem {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  expected_qty: number;
  actual_qty: number | null;
  approved: number;
}

/** GET /api/v1/stock-counts/:id — the count with every item it covers. */
export interface StockCountDetail extends StockCountSummary {
  items: StockCountItem[];
}
