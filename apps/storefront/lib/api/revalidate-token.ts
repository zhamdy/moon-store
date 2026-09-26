/**
 * The shared secret the API presents when it asks the storefront to drop a cache tag.
 * Pure so the route and its tests agree on one rule and neither re-reads the
 * environment (`lib/api/catalog.ts`'s token is read the same way).
 *
 * Rotation follows `CATALOG_SERVER_TOKEN`'s convention exactly: a comma list of
 * `current,next`, so a token can be replaced without a window where one side rejects
 * the other. Server-only, never `NEXT_PUBLIC_`.
 */
export const REVALIDATE_TOKEN_HEADER = 'x-revalidate-token';

/** Matching the catalog token's floor: a shorter secret is a configuration mistake. */
export const MIN_TOKEN_BYTES = 32;

export function parseTokens(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length >= MIN_TOKEN_BYTES);
}

/**
 * Constant-time-ish comparison: length first, then every byte, so a caller cannot read
 * the secret from how quickly a wrong one is refused. The token is short and the route
 * is server-to-server, but a timing oracle on a shared secret is never worth keeping.
 */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * `false` when no token is configured at all: an unauthenticated revalidation endpoint
 * would let anyone flush the cache of every page, so an unconfigured storefront refuses
 * rather than opening.
 */
export function isAuthorized(presented: string | null, configured: string | undefined): boolean {
  const tokens = parseTokens(configured);
  if (tokens.length === 0 || !presented) return false;
  return tokens.some((token) => equals(token, presented));
}
