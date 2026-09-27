import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { resolveApiBaseUrl } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { listCatalogCategories } from './list-catalog-categories';

/**
 * The wayfinding read's deadline, the header's (`NAV_COLLECTIONS_TIMEOUT_MS`) and for the
 * same reason: the locale layout awaits it on every page, so it also runs at `next build`,
 * and an API that accepts the connection and never answers must not hold a page open.
 */
export const CATEGORY_COUNTS_TIMEOUT_MS = 5_000;

/** Active pieces per category slug. */
export type CategoryCounts = ReadonlyMap<string, number>;

function apiConfigured(): boolean {
  try {
    return resolveApiBaseUrl() !== '';
  } catch {
    return false;
  }
}

/**
 * The catalogue's own piece count per category ("Directory", 2026-09-27), for the category
 * photographs on the 404, the empty bag, the empty drawer and the empty checkout. It shares
 * `listCatalogCategories`' entity revalidate and cache tag with the Shop page's category
 * column, so the two can never disagree for longer than one revalidation.
 *
 * `null` when the API cannot answer (unconfigured, as in CI's `next build`; an `ApiError`,
 * logged; or silent past the deadline): the categories still show, without counts. A count
 * is never invented.
 */
export async function loadCategoryCounts(): Promise<CategoryCounts | null> {
  if (!apiConfigured()) {
    return null;
  }
  try {
    const categories = await listCatalogCategories({ timeoutMs: CATEGORY_COUNTS_TIMEOUT_MS });
    return new Map(categories.map((category) => [category.slug, category.productCount]));
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      console.error(`Category counts unavailable: ${error.code} ${error.status}`);
      return null;
    }
    throw error;
  }
}
