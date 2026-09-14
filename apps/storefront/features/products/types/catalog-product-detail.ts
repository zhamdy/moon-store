/** `GET /api/v1/catalog/products/:slug` (product detail). A response DTO, not a server type. */
export interface CatalogProductDetail {
  slug: string;
  /** Arabic; the only name every product has. */
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  /** Whole EGP; the base price when a variant carries none of its own. */
  price: number;
  isNew: boolean;
  /** With variants: any usable variant in stock. */
  inStock: boolean;
  /** Primary first, then the gallery by position; already absolute. */
  images: { url: string }[];
  category: CatalogProductContext | null;
  collections: CatalogProductContext[];
  /** `[]` when the product has no variants. */
  options: CatalogProductOption[];
  variants: CatalogProductVariant[];
}

export interface CatalogProductContext {
  slug: string;
  name: string;
  nameEn: string | null;
}

export interface CatalogProductOption {
  /** Normalised key, the one `CatalogProductVariant.options` uses. */
  key: string;
  label: string;
  values: string[];
}

export interface CatalogProductVariant {
  /** Option key to value, over every option key. */
  options: Record<string, string>;
  /** Effective price, already falling back to the product's. */
  price: number;
  inStock: boolean;
}
