const DEV_SITE_URL = 'http://localhost:3000';

/**
 * The storefront's public origin, from `SITE_URL`: the metadata base and any absolute link
 * the page hands to another site (share links).
 *
 * Read at call time, not at module load, so the value comes from the environment the page
 * is rendered in. Plain process.env is not a request API, so the homepage stays SSG.
 * Missing or malformed in production logs loudly rather than failing the render; canonical,
 * alternate and share links would then point at localhost.
 */
export function resolveSiteUrl(): URL {
  const configured = process.env.SITE_URL;
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      console.error(`SITE_URL is not an absolute URL ("${configured}"); using ${DEV_SITE_URL}`);
      return new URL(DEV_SITE_URL);
    }
  }
  if (process.env.NODE_ENV === 'production') {
    console.error(`SITE_URL is not set; canonical and alternate links use ${DEV_SITE_URL}`);
  }
  return new URL(DEV_SITE_URL);
}
