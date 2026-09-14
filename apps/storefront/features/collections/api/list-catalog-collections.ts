import 'server-only';
import { CATALOG_REVALIDATE, catalogFetch } from '@/lib/api/catalog';
import { CATALOG_ENDPOINTS } from '@/lib/api/endpoints';
import type { CatalogCollection } from '../types/catalog-collection';

/** Live collections only, featured first (the server's order). */
export async function listCatalogCollections(): Promise<CatalogCollection[]> {
  const { data } = await catalogFetch<CatalogCollection[]>(
    CATALOG_ENDPOINTS.collections,
    CATALOG_REVALIDATE.entity
  );
  return data;
}
