import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { REVALIDATE_TOKEN_HEADER, isAuthorized } from '@/lib/api/revalidate-token';

/**
 * On-demand cache invalidation, called by the API after a catalog write.
 *
 * Why it exists: the Next data cache cannot express a withdrawal. It writes an entry
 * only on `res.status === 200`, so once a product is deactivated the background
 * revalidation receives the API's 404, the stale entry is never replaced, and a
 * withdrawn piece keeps serving a purchasable 200 **forever** — measured at 64
 * consecutive samples over 16 minutes against a production build (HIGH-2 in
 * `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`). Lowering `revalidate` does
 * not help: the entry is stale *and still served*. Deletion has to be pushed, so the
 * writer tells the reader.
 *
 * It also gives the operator the lever MED-16 found missing: a wrong price or an urgent
 * withdrawal used to be uncorrectable faster than the TTL.
 *
 * Contract: `POST` with `x-revalidate-token` and `{ "tags": ["catalog:products", ...] }`.
 * 401 with no or a wrong token, 400 on a malformed body, 200 with the tags dropped.
 * Never leaks which tags exist — an unknown tag is accepted and does nothing, exactly as
 * `revalidateTag` treats it.
 */
export const dynamic = 'force-dynamic';

const MAX_TAGS = 50;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request.headers.get(REVALIDATE_TOKEN_HEADER), process.env.REVALIDATE_TOKEN)) {
    // No detail: a caller that cannot authenticate learns nothing about why.
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  const tags =
    typeof body === 'object' && body !== null && 'tags' in body
      ? (body as { tags: unknown }).tags
      : null;

  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    tags.length > MAX_TAGS ||
    !tags.every((tag) => typeof tag === 'string' && tag.length > 0 && tag.length <= 200)
  ) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR' } }, { status: 400 });
  }

  // `{ expire: 0 }`, deliberately not the documented-recommended `'max'`. A profile sets
  // how long stale content may still be served while the revalidation runs, and `max` is
  // a one-year window — which is this bug, not its fix: a withdrawn product would keep
  // serving its purchasable page to every visitor. `{ expire: 0 }` never serves stale,
  // so the next request blocks on fresh data and a withdrawal is immediate. (`updateTag`
  // has that semantic by default but is Server-Action-only and cannot be used here.)
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ data: { revalidated: tags.length } }, { status: 200 });
}
