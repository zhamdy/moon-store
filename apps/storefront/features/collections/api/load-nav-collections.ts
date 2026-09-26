import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { resolveApiBaseUrl } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { CatalogCollection } from '../types/catalog-collection';
import { listCatalogCollections } from './list-catalog-collections';

/** How many collections the header's panels and the mobile menu name. */
export const NAV_COLLECTIONS_LIMIT = 4;

function apiConfigured(): boolean {
  try {
    return resolveApiBaseUrl() !== '';
  } catch {
    return false;
  }
}

/**
 * The live collections the header names (header direction B, 2026-09-26): the public
 * listing, featured first (the server's order), capped at `NAV_COLLECTIONS_LIMIT`. It is
 * read on every page through the layout, so it shares `listCatalogCollections`' entity
 * revalidate and cache tag with the collections index — one data-cache entry.
 *
 * `null` when the API cannot answer (unconfigured, as in CI's `next build`, or an
 * `ApiError`, logged) or there are no live collections. The header then renders
 * Collections as a plain link and the Shop panel without its collections column; a
 * catalog outage never takes the header down with it.
 */
export async function loadNavCollections(): Promise<CatalogCollection[] | null> {
  if (!apiConfigured()) {
    return null;
  }
  try {
    const collections = await listCatalogCollections();
    return collections.length > 0 ? collections.slice(0, NAV_COLLECTIONS_LIMIT) : null;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(`Header collections unavailable: ${error.code} ${error.status}`);
      return null;
    }
    throw error;
  }
}
