export const API_PREFIX = '/api/v1';

/**
 * Endpoint paths, relative to API_PREFIX. Response DTO types live with the feature that
 * owns them (`features/<slice>/types`) and model the API's response DTOs — never a
 * server repository or database type, which the storefront has no visibility into and
 * must not depend on.
 */
export const CATALOG_ENDPOINTS = {
  products: '/catalog/products',
  product: (slug: string) => `/catalog/products/${encodeURIComponent(slug)}`,
  categories: '/catalog/categories',
  collections: '/catalog/collections',
  collection: (slug: string) => `/catalog/collections/${encodeURIComponent(slug)}`,
  storePolicies: '/catalog/store-policies',
  /** The one browser-called catalog path (CD-4): a POST, read-only. */
  cartQuote: '/catalog/cart/quote',
} as const;
