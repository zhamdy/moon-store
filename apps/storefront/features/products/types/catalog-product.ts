/** `GET /api/v1/catalog/products` item (KD-3). A response DTO, not a server type. */
export interface CatalogProduct {
  slug: string;
  /** Arabic; the only name every product has. */
  name: string;
  nameEn: string | null;
  /** Whole EGP. */
  price: number;
  /** At most two, already absolute; the storefront never resolves image URLs. */
  images: { url: string }[];
  isNew: boolean;
  inStock: boolean;
}

export interface CatalogPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** The scope's active price bounds, ignoring the price filter; null when the scope is empty. */
export interface CatalogPriceRange {
  min: number | null;
  max: number | null;
}

export interface CatalogProductPage {
  items: CatalogProduct[];
  pagination: CatalogPagination;
  priceRange: CatalogPriceRange;
}
