import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:3001\/api\/products/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'products-cache', expiration: { maxEntries: 200, maxAgeSeconds: 86400 } }
          },
          {
            urlPattern: /^https?:\/\/localhost:3001\/api\/sales/,
            handler: 'NetworkFirst',
            options: { cacheName: 'sales-cache', expiration: { maxEntries: 50, maxAgeSeconds: 3600 } }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  }
});
