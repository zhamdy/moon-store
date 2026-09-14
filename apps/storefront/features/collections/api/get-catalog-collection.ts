import 'server-only';
import { CATALOG_REVALIDATE, catalogFetch } from '@/lib/api/catalog';
import { CATALOG_ENDPOINTS } from '@/lib/api/endpoints';
import { isApiError } from '@/lib/api/errors';
import type { CatalogCollection } from '../types/catalog-collection';

/**
 * `null` only for NOT_FOUND (unknown, upcoming or archived: the API does not tell them
 * apart), so the page can `notFound()`. Every other failure rethrows to the error
 * boundary rather than masquerading as a 404.
 */
export async function getCatalogCollection(slug: string): Promise<CatalogCollection | null> {
  try {
    const { data } = await catalogFetch<CatalogCollection>(
      CATALOG_ENDPOINTS.collection(slug),
      CATALOG_REVALIDATE.entity
    );
    return data;
  } catch (error) {
    if (isApiError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}
