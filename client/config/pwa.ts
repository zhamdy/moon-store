import type { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
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
    runtimeCaching: [
      {
        urlPattern: /\/api\/v1\/products/,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'products-cache', expiration: { maxEntries: 200, maxAgeSeconds: 86400 } },
      },
      {
        urlPattern: /\/api\/v1\/sales/,
        handler: 'NetworkFirst',
        options: { cacheName: 'sales-cache', expiration: { maxEntries: 50, maxAgeSeconds: 3600 } },
      },
    ],
  },
};
