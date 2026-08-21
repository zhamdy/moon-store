export interface BundleRecord {
  id: number;
  name: string;
  description?: string | null;
  bundle_price: number;
  starts_at?: string | null;
  expires_at?: string | null;
  status: string;
  item_count?: number;
  original_price?: number;
  created_at: string;
  updated_at: string;
}

export interface BundleItemRecord {
  id: number;
  bundle_id: number;
  product_id: number;
  quantity: number;
  product_name?: string;
  sku?: string;
  original_price?: number;
  stock?: number;
  image_url?: string | null;
}

export interface BundleDetailRecord extends BundleRecord {
  items: BundleItemRecord[];
}

export interface BundleItemDTO {
  product_id: number;
  quantity?: number;
}

export interface CreateBundleDTO {
  name: string;
  description?: string | null;
  bundle_price: number;
  starts_at?: string | null;
  expires_at?: string | null;
  items: BundleItemDTO[];
}

export type UpdateBundleDTO = CreateBundleDTO;

export interface BundleFilters {
  status?: string;
  page?: number;
  limit?: number;
}
