export interface CollectionRecord {
  id: number;
  name: string;
  description?: string | null;
  season?: string | null;
  is_featured: number | boolean;
  product_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface CollectionProductRecord {
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
  position: number;
  [key: string]: any;
}

export interface CollectionDetailRecord extends CollectionRecord {
  products: CollectionProductRecord[];
}

export interface CreateCollectionDTO {
  name: string;
  description?: string | null;
  season?: string | null;
  is_featured?: boolean;
  product_ids?: number[];
}

export type UpdateCollectionDTO = CreateCollectionDTO;

export interface CollectionFilters {
  season?: string;
  featured?: string;
}
