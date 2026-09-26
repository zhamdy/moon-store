import 'server-only';
import {
  CATALOG_REVALIDATE,
  catalogFetch,
  catalogTags,
  type CatalogFetchOptions,
} from '@/lib/api/catalog';
import { CATALOG_ENDPOINTS } from '@/lib/api/endpoints';
import type { CatalogCollection } from '../types/catalog-collection';

/**
 * Live collections only, featured first (the server's order). The index page reads it
 * with no options, so `generateMetadata` and the page share one memoized fetch; the
 * header's read passes a deadline (see `loadNavCollections`).
 */
export async function listCatalogCollections(
  options: CatalogFetchOptions = {}
): Promise<CatalogCollection[]> {
  const { data } = await catalogFetch<CatalogCollection[]>(
    CATALOG_ENDPOINTS.collections,
    CATALOG_REVALIDATE.entity,
    [catalogTags.collections],
    options
  );
  return data;
}
