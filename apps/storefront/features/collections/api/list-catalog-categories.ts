import 'server-only';
import {
  CATALOG_REVALIDATE,
  catalogFetch,
  catalogTags,
  type CatalogFetchOptions,
} from '@/lib/api/catalog';
import { CATALOG_ENDPOINTS } from '@/lib/api/endpoints';
import type { CatalogCategory } from '../types/catalog-category';

/**
 * Every category with its active-product count. Pages read it with no options, so
 * `generateMetadata` and the page share one memoized fetch; the wayfinding read passes a
 * deadline (see `loadCategoryCounts`).
 */
export async function listCatalogCategories(
  options: CatalogFetchOptions = {}
): Promise<CatalogCategory[]> {
  const { data } = await catalogFetch<CatalogCategory[]>(
    CATALOG_ENDPOINTS.categories,
    CATALOG_REVALIDATE.entity,
    [catalogTags.categories],
    options
  );
  return data;
}

/**
 * A category resolved from the cached list, not a detail route (KD-1). `null` means
 * unknown, so the page can `notFound()`; a failed list read still throws. A category
 * with zero products is found.
 */
export async function findCatalogCategory(slug: string): Promise<CatalogCategory | null> {
  const categories = await listCatalogCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}
