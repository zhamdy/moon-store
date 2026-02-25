# Offline & PWA

## PWA Configuration

The app is a Progressive Web App configured via `vite-plugin-pwa` (Workbox) in `client/vite.config.ts`.

### Manifest

```json
{
  "name": "MOON Fashion & Style",
  "short_name": "MOON",
  "theme_color": "#C9A96E",
  "background_color": "#0D0D0D",
  "display": "standalone",
  "start_url": "/"
}
```

Icons: `pwa-192x192.png` and `pwa-512x512.png` (also used as maskable icon).

### Service Worker

- **Registration**: Auto-update (`registerType: 'autoUpdate'`)
- **Precache**: All static assets (JS, CSS, HTML, icons, fonts) up to 3MB per file
- **Glob patterns**: `**/*.{js,css,html,ico,png,svg,woff2}`

### Runtime Caching

| API Pattern | Strategy | Cache Name | Max Entries | Max Age |
|-------------|----------|------------|-------------|---------|
| `/api/products` | StaleWhileRevalidate | `products-cache` | 200 | 24 hours |
| `/api/sales` | NetworkFirst | `sales-cache` | 50 | 1 hour |

- **StaleWhileRevalidate** (products): Serves cached data immediately, fetches update in background. Good for product catalog which changes infrequently.
- **NetworkFirst** (sales): Tries network first, falls back to cache. Ensures sales data is as fresh as possible.

### Install Prompt

The `PWAInstallPrompt` component (`client/src/components/PWAInstallPrompt.tsx`) shows an install banner:
- Appears after 30 seconds on first visit
- Uses the `beforeinstallprompt` browser event
- Dismissable by the user

---

## Offline Queue System

### Architecture

```
User action (offline) → offlineStore.addToQueue() → persisted in localStorage
                                                     ↓
Network restored → useOffline hook detects → syncs each queued action via API
                                              ↓
Success → offlineStore.removeFromQueue()
```

### Offline Store (`client/src/store/offlineStore.ts`)

```typescript
interface OfflineQueueItem {
  id: number;        // Date.now() timestamp as unique ID
  type: string;      // Action type (e.g., 'CREATE_SALE')
  payload: object;   // Full request payload
  createdAt: string; // ISO timestamp
}

interface OfflineState {
  queue: OfflineQueueItem[];
  isSyncing: boolean;
  addToQueue(action): void;
  removeFromQueue(id): void;
  clearQueue(): void;
  setSyncing(boolean): void;
  getQueueLength(): number;
}
```

- **Persistence**: Zustand `persist` middleware with key `moon-offline-queue` (localStorage)
- **Sync state**: `isSyncing` flag prevents concurrent sync attempts

### Offline Banner

The `Layout` component shows an offline banner at the top of the page when the browser loses connectivity, giving visual feedback to the user.

### CartPanel Offline Fallback

When offline, the `CartPanel` checkout flow:
1. Detects no network connectivity
2. Queues the sale in `offlineStore` instead of calling the API
3. Shows a toast indicating the sale was saved offline
4. When connectivity returns, the `useOffline` hook processes the queue

### Server-Side Queue Table

The database also has an `offline_sync_queue` table for server-side tracking:

```sql
CREATE TABLE offline_sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## API Client Token Refresh

The Axios client (`client/src/services/api.ts`) handles auth transparently:

1. **Request interceptor**: Attaches `Bearer <accessToken>` from `authStore`
2. **Response interceptor** (on 401):
   - If not already refreshing: calls `POST /api/auth/refresh` with httpOnly cookie
   - If already refreshing: queues the failed request
   - On success: updates `authStore`, replays all queued requests with new token
   - On failure: logs out user, redirects to `/login`

This ensures seamless token renewal without user intervention.

---

## Deployment Considerations

- The runtime caching URL patterns are hardcoded to `localhost:3001`. For production, update the patterns in `vite.config.ts` to match the production API domain.
- The service worker precaches all assets, so the initial download can be large (~3MB). Subsequent visits load from cache.
- `maximumFileSizeToCacheInBytes` is set to 3MB to accommodate the SPA bundle.
