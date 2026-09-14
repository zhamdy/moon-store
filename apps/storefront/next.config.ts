import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const isProduction = process.env.NODE_ENV === 'production';

type RemotePatterns = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>;

/**
 * The one origin catalog images come from (the API's MEDIA_PUBLIC_BASE_URL origin, or
 * the S3/CDN host). Read at build time, because the optimizer's allowlist is fixed then.
 * A malformed value fails the build. Unset in production allows no remote images, so
 * product photographs fail visibly rather than through an open allowlist; the warning
 * is not fatal because CI builds with no catalog route calling the API.
 */
function mediaRemotePatterns(): RemotePatterns {
  const configured =
    process.env.MEDIA_ORIGIN ?? (isProduction ? undefined : 'http://localhost:3001');
  if (!configured) {
    console.warn('[config] MEDIA_ORIGIN is not set; catalog images will not load.');
    return [];
  }
  const origin = new URL(configured);
  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
    throw new Error(`MEDIA_ORIGIN must be an http(s) origin, got "${configured}".`);
  }
  return [
    {
      protocol: origin.protocol === 'https:' ? 'https' : 'http',
      hostname: origin.hostname,
      port: origin.port,
      pathname: '/**',
    },
  ];
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: mediaRemotePatterns(),
    qualities: [75],
    // Dev media is served from localhost, which the optimizer refuses by default as an
    // SSRF guard. Never in production.
    dangerouslyAllowLocalIP: !isProduction,
  },
};

export default withNextIntl(nextConfig);
