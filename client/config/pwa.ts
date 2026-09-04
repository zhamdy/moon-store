import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * What this app is allowed to keep on a till, and when it is allowed to restart itself.
 *
 * ## Updates never interrupt a sale
 *
 * `registerType` is `prompt`, not `autoUpdate`. Under `autoUpdate` a new service worker
 * calls `skipWaiting`, takes over, and the injected registration reloads the page — which
 * it will happily do with a half-rung-up cart on screen, because nothing in a service
 * worker knows what a checkout is. Under `prompt` the new worker stays in `waiting` and
 * takes over only once every tab for this origin has closed, so an update lands between
 * shifts rather than during one.
 *
 * The cost is that a till running continuously for days keeps the old build until it is
 * closed. For a point of sale that is the right side of the trade, and it is the whole
 * point: no deploy can reload a screen someone is taking money on. Nothing here calls
 * `updateSW()`, deliberately — an "update now" button is a fine thing to add later, but
 * it has to know whether a checkout is open, and that is not a service-worker concern.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  includeAssets: ['moon-logo.svg'],
  manifest: {
    name: 'MOON Fashion & Style',
    short_name: 'MOON',
    description: 'Shop management for MOON Fashion & Style',
    theme_color: '#C9A96E',
    background_color: '#0D0D0D',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  },
  workbox: {
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    /**
     * Only the product catalogue is cached, and only because a till that cannot read it
     * cannot ring anything up. It is shop reference data: the same for every user, not
     * about anybody, and stale-while-revalidate means a price correction is one request
     * behind rather than a day behind.
     *
     * `/api/v1/sales` used to be cached here with NetworkFirst. A till is shared — a
     * cashier signs out and the next one signs in — and the Cache Storage a service
     * worker writes is per-origin, not per-user, and is not cleared by logging out. So
     * that entry left one user's transaction history readable to the next, and served it
     * back for an hour with no way to tell a cached response from a live one. A sales
     * response is somebody's purchase record; it does not belong in a cache keyed on
     * nothing but a URL.
     *
     * The rule for anything added here: cache what the shop knows, never what a person
     * did. Sales, refunds, shifts, customers and audit responses all fail that test.
     */
    runtimeCaching: [
      {
        urlPattern: /\/api\/v1\/products/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'products-cache',
          expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
        },
      },
    ],
  },
};
