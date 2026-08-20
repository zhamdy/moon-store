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
  product_count: number;
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

/** A pending price change from GET /api/v1/ai/pricing/suggestions. */
export interface PriceSuggestion {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  current_price: number;
  suggested_price: number;
  reason: string;
  confidence: number;
  status: string;
}

/** A standing rule from GET /api/v1/ai/pricing/rules. */
export interface PricingRule {
  id: number;
  name: string;
  rule_type: string;
  config: string;
  priority: number;
  is_active: number;
  applies_to: string;
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
