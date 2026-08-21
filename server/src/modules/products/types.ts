export interface ProductRecord {
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
  has_variants: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProductDTO {
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
}

export type UpdateProductDTO = CreateProductDTO;

export interface BulkUpdateDTO {
  category_id?: number;
  distributor_id?: number | null;
  price_percent?: number;
  status?: 'active' | 'inactive' | 'discontinued';
}

export interface AdjustStockDTO {
  delta: number;
  reason: string;
}

export interface VariantDTO {
  sku: string;
  barcode?: string | null;
  price?: number | null;
  cost_price: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  category_id?: number;
  collection_id?: number;
  status?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
