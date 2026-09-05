/**
 * Where the API lives, resolved once.
 *
 * `VITE_API_URL` is baked in at **build** time, not read at runtime — Vite substitutes
 * `import.meta.env.*` into the bundle — so this is decided by the deploy that produced the
 * JavaScript, and cannot be corrected by changing configuration afterwards.
 *
 * ## Why a production build never falls back to localhost
 *
 * Five call sites used to spell this as `import.meta.env.VITE_API_URL ||
 * 'http://localhost:3001'`, and three more hardcoded that URL outright. A deploy that
 * forgot to set `VITE_API_URL` therefore shipped a bundle asking every visitor's browser
 * to call **its own machine**. Every request fails, every page that touches data throws,
 * and nothing in the build or the logs says why — the app looks broken rather than
 * misconfigured, which is a much more expensive thing to debug.
 *
 * So the fallback is split by build mode:
 *
 * - **dev**: `http://localhost:3001`, which is where `npm run dev` serves the API.
 * - **production**: same origin, plus a loud console error naming the missing variable.
 *   Same origin is not a working default — the SPA rewrite (`vercel.json` /
 *   `public/_redirects`) answers `/api/*` with `index.html` — but it fails *locally and
 *   visibly* instead of pointing at a machine that has nothing to do with this
 *   deployment. It also cannot silently succeed against a developer who happens to have
 *   the server running, which is the failure mode that hides this bug the longest.
 *
 * Deliberately not a throw: taking a running app down over a bad base URL is a worse
 * outcome than degrading with an explanation in the console, and the pages already render
 * an error state for a failed request.
 */

const configured = import.meta.env.VITE_API_URL;

function resolveApiBaseUrl(): string {
  if (configured) return configured.replace(/\/+$/, '');

  if (import.meta.env.PROD) {
    console.error(
      '[config] VITE_API_URL was not set when this bundle was built, so the app does not ' +
        'know where its API is. Set it in the deploy environment and rebuild — it is baked ' +
        'in at build time and cannot be changed after the fact. Falling back to this origin, ' +
        'which will not serve the API.'
    );
    return '';
  }

  return 'http://localhost:3001';
}

/** Base URL for API calls. No trailing slash. Empty string means "this origin". */
export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Base URL for files the API serves (product images under `/uploads`).
 *
 * The same origin as the API today. It is named separately because it does not have to
 * stay that way: `MEDIA_PUBLIC_BASE_URL` on the server can point image URLs at a CDN, and
 * when it does those rows already carry absolute URLs, so nothing should be prefixed at
 * all. Callers must therefore only prefix a *relative* `image_url` — see `assetUrl`.
 */
export const ASSET_BASE_URL = API_BASE_URL;

/**
 * Resolves a stored `image_url` to something loadable.
 *
 * Handles the case the media migration creates: rows written before a CDN move hold
 * `/uploads/...` and need the API origin in front, while rows written after hold an
 * absolute URL and must be left exactly as they are. Prefixing an absolute URL produces
 * `https://cdn.example.com` glued onto the API host, which 404s.
 */
export function assetUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(imageUrl) || imageUrl.startsWith('//')) return imageUrl;
  return `${ASSET_BASE_URL}${imageUrl}`;
}
