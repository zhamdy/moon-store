import logger from '../../lib/logger';

/**
 * Tells the storefront to drop the cache tags a catalog write just invalidated.
 *
 * Why the API pushes at all: Next's data cache writes an entry only on a 200, so once a
 * product is withdrawn the storefront's own revalidation receives this API's 404, the
 * stale entry is never replaced, and the withdrawn piece keeps serving a purchasable
 * page indefinitely — 64 consecutive samples over 16 minutes against a production build
 * (HIGH-2 in `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`). A shorter TTL does
 * not fix it, because the entry is stale *and still served*. The reader cannot discover
 * a deletion, so the writer has to say so.
 *
 * **Best-effort by construction.** It never throws, never blocks the response, and is
 * bounded by its own timeout: publishing a catalogue change must not fail or slow an
 * operator's save because the storefront is down, slow or not deployed yet. A failure
 * is logged and the TTL remains the backstop it always was.
 *
 * Unconfigured (`STOREFRONT_REVALIDATE_URL` or `STOREFRONT_REVALIDATE_TOKEN` unset) it
 * does nothing at all, which is the correct behaviour for the POS-only deployments that
 * run no storefront.
 */
const TIMEOUT_MS = 2_000;

/** Mirrors `apps/storefront/lib/api/catalog.ts` `catalogTags`. Neither app may import the
 * other, so the vocabulary is duplicated by hand; change both together
 * (docs/CONVENTIONS.md, the global string-coupling contract). */
export const storefrontTags = {
  products: 'catalog:products',
  product: (slug: string) => `catalog:product:${slug}`,
  categories: 'catalog:categories',
  collections: 'catalog:collections',
  collection: (slug: string) => `catalog:collection:${slug}`,
  storePolicies: 'catalog:store-policies',
} as const;

export async function revalidateStorefront(tags: string[]): Promise<void> {
  const url = process.env.STOREFRONT_REVALIDATE_URL;
  const token = process.env.STOREFRONT_REVALIDATE_TOKEN;
  if (!url || !token || tags.length === 0) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-token': token },
      body: JSON.stringify({ tags }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn('storefront_revalidate_failed', { status: res.status, tags });
    }
  } catch (error) {
    logger.warn('storefront_revalidate_failed', {
      error: error instanceof Error ? error.message : String(error),
      tags,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire-and-forget: the caller does not await, so the operator's response is never held
 * behind the storefront. The promise is explicitly caught, since an unhandled rejection
 * would take the process down.
 */
export function revalidateStorefrontInBackground(tags: string[]): void {
  void revalidateStorefront(tags).catch(() => {});
}
