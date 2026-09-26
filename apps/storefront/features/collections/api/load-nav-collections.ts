import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { resolveApiBaseUrl } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { CatalogCollection } from '../types/catalog-collection';
import { listCatalogCollections } from './list-catalog-collections';

/** How many collections the header's panels and the mobile menu name. */
export const NAV_COLLECTIONS_LIMIT = 4;

/**
 * The header read's deadline. The locale layout awaits this read on every page, so it
 * is the one catalog fetch that also runs at `next build` (the prerendered pages) and on
 * every request-time render: with no deadline, an API that accepts the connection and
 * never answers held each page open until Next's 60s static-generation limit and
 * failed the build (Vercel, 2026-09-26). The signal opts this call out of per-render
 * memoization, so on `/collections` the page's own read is a second fetch — both share
 * the data cache, so it costs one extra API call per revalidation of that page only.
 */
export const NAV_COLLECTIONS_TIMEOUT_MS = 5_000;

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
 * `null` when the API cannot answer (unconfigured, as in CI's `next build`; an
 * `ApiError`, logged; or silent past `NAV_COLLECTIONS_TIMEOUT_MS`) or there are no live
 * collections. The header then renders Collections as a plain link and the Shop panel
 * without its collections column; a catalog outage never takes the header down with
 * it, and never holds a page open.
 */
export async function loadNavCollections(): Promise<CatalogCollection[] | null> {
  if (!apiConfigured()) {
    return null;
  }
  try {
    const collections = await listCatalogCollections({ timeoutMs: NAV_COLLECTIONS_TIMEOUT_MS });
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
