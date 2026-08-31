# API Endpoint Health & Verification Diagnostic Report

**Execution Date:** 2026-08-31T20:52:28.754Z

## Summary

| Metric | Count | Percentage |
|---|---|---|
| Total Endpoints Tested | 200 | 100% |
| Successes (2xx/3xx) | 113 | 56.5% |
| Client Errors (4xx) | 87 | 43.5% |
| Server Errors (500s) | 0 | 0.0% |

> [!NOTE]
> All tested endpoints passed without unhandled 500 Internal Server Errors.

## All Endpoint Results

| Method | Path | Role | Status | Duration | Result |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | `Public` | `200` | 184ms | ✅ |
| `POST` | `/api/v1/auth/refresh` | `Public` | `401` | 7ms | ⚠️ (4xx) |
| `POST` | `/api/v1/auth/logout` | `Admin` | `204` | 7ms | ✅ |
| `GET` | `/api/v1/auth/me` | `Admin` | `200` | 10ms | ✅ |
| `GET` | `/api/v1/users` | `Admin` | `200` | 19ms | ✅ |
| `GET` | `/api/v1/users/delivery` | `Admin` | `200` | 6ms | ✅ |
| `POST` | `/api/v1/users` | `Admin` | `201` | 163ms | ✅ |
| `GET` | `/api/v1/users/me/favorites` | `Admin` | `200` | 7ms | ✅ |
| `PUT` | `/api/v1/users/me/favorites` | `Admin` | `400` | 9ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/users/1` | `Admin` | `200` | 16ms | ✅ |
| `DELETE` | `/api/v1/users/1` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/settings` | `Admin` | `200` | 7ms | ✅ |
| `PUT` | `/api/v1/settings` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `GET` | `/api/v1/audit-log` | `Admin` | `200` | 12ms | ✅ |
| `GET` | `/api/v1/audit-log/actions` | `Admin` | `200` | 7ms | ✅ |
| `GET` | `/api/v1/audit-log/entity-types` | `Admin` | `200` | 7ms | ✅ |
| `GET` | `/api/v1/branches` | `Admin` | `200` | 39ms | ✅ |
| `POST` | `/api/v1/branches` | `Admin` | `201` | 15ms | ✅ |
| `GET` | `/api/v1/branches/consolidated` | `Admin` | `200` | 38ms | ✅ |
| `GET` | `/api/v1/branches/transfers` | `Admin` | `200` | 32ms | ✅ |
| `POST` | `/api/v1/branches/transfers` | `Admin` | `400` | 5ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/branches/transfers/1/status` | `Admin` | `400` | 5ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/branches/1` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `GET` | `/api/v1/sales` | `Admin` | `200` | 37ms | ✅ |
| `POST` | `/api/v1/sales` | `Admin` | `400` | 5ms | ⚠️ (4xx) |
| `GET` | `/api/v1/sales/1` | `Admin` | `404` | 16ms | ⚠️ (4xx) |
| `POST` | `/api/v1/sales/1/refund` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `GET` | `/api/v1/register/current` | `Admin` | `200` | 32ms | ✅ |
| `POST` | `/api/v1/register/open` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `POST` | `/api/v1/register/movement` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `POST` | `/api/v1/register/close` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/register/history` | `Admin` | `200` | 37ms | ✅ |
| `GET` | `/api/v1/register/1/report` | `Admin` | `404` | 11ms | ⚠️ (4xx) |
| `POST` | `/api/v1/register/1/force-close` | `Admin` | `404` | 12ms | ⚠️ (4xx) |
| `GET` | `/api/v1/shifts/current` | `Admin` | `200` | 12ms | ✅ |
| `POST` | `/api/v1/shifts/clock-in` | `Admin` | `201` | 18ms | ✅ |
| `POST` | `/api/v1/shifts/clock-out` | `Admin` | `400` | 21ms | ⚠️ (4xx) |
| `POST` | `/api/v1/shifts/break/start` | `Admin` | `200` | 10ms | ✅ |
| `POST` | `/api/v1/shifts/break/end` | `Admin` | `400` | 13ms | ⚠️ (4xx) |
| `GET` | `/api/v1/shifts` | `Admin` | `200` | 19ms | ✅ |
| `POST` | `/api/v1/exchanges` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/exchanges` | `Admin` | `200` | 16ms | ✅ |
| `GET` | `/api/v1/exchanges/1` | `Admin` | `404` | 13ms | ⚠️ (4xx) |
| `POST` | `/api/v1/layaway` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/layaway` | `Admin` | `200` | 21ms | ✅ |
| `GET` | `/api/v1/layaway/1` | `Admin` | `404` | 13ms | ⚠️ (4xx) |
| `POST` | `/api/v1/layaway/1/pay` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `POST` | `/api/v1/layaway/1/cancel` | `Admin` | `404` | 6ms | ⚠️ (4xx) |
| `POST` | `/api/v1/reservations` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/reservations/1` | `Admin` | `404` | 7ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/reservations/source/:sourceId` | `Admin` | `200` | 6ms | ✅ |
| `GET` | `/api/v1/products` | `Admin` | `200` | 42ms | ✅ |
| `GET` | `/api/v1/products/categories` | `Admin` | `200` | 6ms | ✅ |
| `GET` | `/api/v1/products/lookup` | `Admin` | `400` | 6ms | ⚠️ (4xx) |
| `GET` | `/api/v1/products/generate-sku/1` | `Admin` | `200` | 13ms | ✅ |
| `GET` | `/api/v1/products/generate-barcode` | `Admin` | `200` | 10ms | ✅ |
| `GET` | `/api/v1/products/barcode/:barcode` | `Admin` | `404` | 19ms | ⚠️ (4xx) |
| `POST` | `/api/v1/products/batch-generate-barcodes` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/products/bulk-update` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `POST` | `/api/v1/products/bulk-delete` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `POST` | `/api/v1/products/import` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/products/1` | `Admin` | `200` | 12ms | ✅ |
| `POST` | `/api/v1/products` | `Admin` | `201` | 12ms | ✅ |
| `PUT` | `/api/v1/products/1` | `Admin` | `400` | 5ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/products/1/status` | `Admin` | `400` | 2ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/products/1` | `Admin` | `204` | 10ms | ✅ |
| `POST` | `/api/v1/products/1/adjust-stock` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `GET` | `/api/v1/products/1/stock-history` | `Admin` | `200` | 10ms | ✅ |
| `POST` | `/api/v1/products/1/image` | `Admin` | `400` | 5ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/products/1/image` | `Admin` | `403` | 6ms | ⚠️ (4xx) |
| `GET` | `/api/v1/products/1/variants` | `Admin` | `200` | 5ms | ✅ |
| `POST` | `/api/v1/products/1/variants` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/products/1/variants/1` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/products/1/variants/1` | `Admin` | `404` | 11ms | ⚠️ (4xx) |
| `GET` | `/api/v1/products/1/price-history` | `Admin` | `200` | 10ms | ✅ |
| `GET` | `/api/v1/categories` | `Admin` | `200` | 24ms | ✅ |
| `POST` | `/api/v1/categories` | `Admin` | `400` | 2ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/categories/1` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/categories/1` | `Admin` | `409` | 7ms | ⚠️ (4xx) |
| `GET` | `/api/v1/distributors` | `Admin` | `200` | 28ms | ✅ |
| `POST` | `/api/v1/distributors` | `Admin` | `201` | 12ms | ✅ |
| `PUT` | `/api/v1/distributors/1` | `Admin` | `200` | 5ms | ✅ |
| `DELETE` | `/api/v1/distributors/1` | `Admin` | `409` | 6ms | ⚠️ (4xx) |
| `GET` | `/api/v1/stock-counts` | `Admin` | `200` | 31ms | ✅ |
| `POST` | `/api/v1/stock-counts` | `Admin` | `201` | 138ms | ✅ |
| `GET` | `/api/v1/stock-counts/1` | `Admin` | `200` | 23ms | ✅ |
| `PUT` | `/api/v1/stock-counts/1/items/:itemId` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `POST` | `/api/v1/stock-counts/1/complete` | `Admin` | `200` | 22ms | ✅ |
| `POST` | `/api/v1/stock-counts/1/cancel` | `Admin` | `409` | 7ms | ⚠️ (4xx) |
| `GET` | `/api/v1/stock-adjustments` | `Admin` | `200` | 12ms | ✅ |
| `GET` | `/api/v1/bundles` | `Admin` | `200` | 33ms | ✅ |
| `GET` | `/api/v1/bundles/1` | `Admin` | `404` | 6ms | ⚠️ (4xx) |
| `POST` | `/api/v1/bundles` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/bundles/1` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/bundles/1` | `Admin` | `404` | 8ms | ⚠️ (4xx) |
| `GET` | `/api/v1/collections` | `Admin` | `200` | 26ms | ✅ |
| `GET` | `/api/v1/collections/1` | `Admin` | `404` | 5ms | ⚠️ (4xx) |
| `POST` | `/api/v1/collections` | `Admin` | `201` | 10ms | ✅ |
| `PUT` | `/api/v1/collections/1` | `Admin` | `200` | 15ms | ✅ |
| `DELETE` | `/api/v1/collections/1` | `Admin` | `204` | 10ms | ✅ |
| `GET` | `/api/v1/label-templates` | `Admin` | `200` | 4ms | ✅ |
| `POST` | `/api/v1/label-templates` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/label-templates/1` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/label-templates/1` | `Admin` | `404` | 6ms | ⚠️ (4xx) |
| `GET` | `/api/v1/customers` | `Admin` | `200` | 9ms | ✅ |
| `POST` | `/api/v1/customers` | `Admin` | `201` | 4ms | ✅ |
| `GET` | `/api/v1/customers/1` | `Admin` | `404` | 1ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/customers/1` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/customers/1/stats` | `Admin` | `200` | 13ms | ✅ |
| `GET` | `/api/v1/customers/1/sales` | `Admin` | `200` | 30ms | ✅ |
| `GET` | `/api/v1/customers/1/loyalty` | `Admin` | `200` | 17ms | ✅ |
| `POST` | `/api/v1/customers/1/loyalty/adjust` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/customers/1` | `Admin` | `204` | 12ms | ✅ |
| `GET` | `/api/v1/coupons` | `Admin` | `200` | 17ms | ✅ |
| `POST` | `/api/v1/coupons` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `POST` | `/api/v1/coupons/validate` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/coupons/1` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/coupons/1` | `Admin` | `204` | 8ms | ✅ |
| `GET` | `/api/v1/gift-cards` | `Admin` | `200` | 21ms | ✅ |
| `POST` | `/api/v1/gift-cards` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `GET` | `/api/v1/gift-cards/MOON10/balance` | `Admin` | `404` | 7ms | ⚠️ (4xx) |
| `POST` | `/api/v1/gift-cards/MOON10/redeem` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/gift-cards/1/transactions` | `Admin` | `200` | 17ms | ✅ |
| `PUT` | `/api/v1/gift-cards/1` | `Admin` | `400` | 2ms | ⚠️ (4xx) |
| `POST` | `/api/v1/feedback` | `Admin` | `201` | 3ms | ✅ |
| `GET` | `/api/v1/feedback` | `Admin` | `200` | 22ms | ✅ |
| `GET` | `/api/v1/segments` | `Admin` | `200` | 17ms | ✅ |
| `POST` | `/api/v1/segments` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/segments/1` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/segments/1` | `Admin` | `404` | 7ms | ⚠️ (4xx) |
| `GET` | `/api/v1/storefront/banners` | `Public` | `200` | 5ms | ✅ |
| `GET` | `/api/v1/storefront/banners/all` | `Admin` | `200` | 4ms | ✅ |
| `POST` | `/api/v1/storefront/banners` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/storefront/banners/1` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/storefront/banners/1` | `Admin` | `404` | 7ms | ⚠️ (4xx) |
| `POST` | `/api/v1/online-orders` | `Public` | `400` | 1ms | ⚠️ (4xx) |
| `GET` | `/api/v1/online-orders` | `Admin` | `200` | 40ms | ✅ |
| `GET` | `/api/v1/online-orders/1` | `Admin` | `404` | 6ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/online-orders/1/status` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `GET` | `/api/v1/vendors` | `Admin` | `200` | 28ms | ✅ |
| `POST` | `/api/v1/vendors` | `Admin` | `201` | 12ms | ✅ |
| `PUT` | `/api/v1/vendors/1` | `Admin` | `200` | 11ms | ✅ |
| `GET` | `/api/v1/vendors/1/payouts` | `Admin` | `200` | 13ms | ✅ |
| `POST` | `/api/v1/vendors/1/payouts` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/warranty` | `Admin` | `200` | 12ms | ✅ |
| `POST` | `/api/v1/warranty` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/warranty/1` | `Admin` | `404` | 14ms | ⚠️ (4xx) |
| `GET` | `/api/v1/delivery` | `Admin` | `200` | 11ms | ✅ |
| `GET` | `/api/v1/delivery/analytics/performance` | `Admin` | `200` | 35ms | ✅ |
| `GET` | `/api/v1/delivery/1` | `Admin` | `404` | 6ms | ⚠️ (4xx) |
| `POST` | `/api/v1/delivery` | `Admin` | `400` | 2ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/delivery/1` | `Admin` | `400` | 4ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/delivery/1/status` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/delivery/1/history` | `Admin` | `200` | 10ms | ✅ |
| `GET` | `/api/v1/shipping-companies` | `Admin` | `200` | 20ms | ✅ |
| `POST` | `/api/v1/shipping-companies` | `Admin` | `201` | 6ms | ✅ |
| `PUT` | `/api/v1/shipping-companies/1` | `Admin` | `200` | 13ms | ✅ |
| `DELETE` | `/api/v1/shipping-companies/1` | `Admin` | `204` | 8ms | ✅ |
| `GET` | `/api/v1/purchase-orders` | `Admin` | `200` | 29ms | ✅ |
| `GET` | `/api/v1/purchase-orders/1` | `Admin` | `404` | 10ms | ⚠️ (4xx) |
| `POST` | `/api/v1/purchase-orders` | `Admin` | `400` | 2ms | ⚠️ (4xx) |
| `PUT` | `/api/v1/purchase-orders/1/status` | `Admin` | `400` | 2ms | ⚠️ (4xx) |
| `POST` | `/api/v1/purchase-orders/1/receive` | `Admin` | `400` | 2ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/purchase-orders/1` | `Admin` | `404` | 5ms | ⚠️ (4xx) |
| `GET` | `/api/v1/expenses` | `Admin` | `200` | 18ms | ✅ |
| `POST` | `/api/v1/expenses` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `GET` | `/api/v1/expenses/pnl` | `Admin` | `200` | 33ms | ✅ |
| `PUT` | `/api/v1/expenses/1` | `Admin` | `400` | 3ms | ⚠️ (4xx) |
| `DELETE` | `/api/v1/expenses/1` | `Admin` | `404` | 6ms | ⚠️ (4xx) |
| `GET` | `/api/v1/analytics/dashboard-all` | `Admin` | `200` | 164ms | ✅ |
| `GET` | `/api/v1/analytics/dashboard` | `Admin` | `200` | 12ms | ✅ |
| `GET` | `/api/v1/analytics/revenue` | `Admin` | `200` | 5ms | ✅ |
| `GET` | `/api/v1/analytics/top-products` | `Admin` | `200` | 34ms | ✅ |
| `GET` | `/api/v1/analytics/payment-methods` | `Admin` | `200` | 5ms | ✅ |
| `GET` | `/api/v1/analytics/orders-per-day` | `Admin` | `200` | 4ms | ✅ |
| `GET` | `/api/v1/analytics/cashier-performance` | `Admin` | `200` | 51ms | ✅ |
| `GET` | `/api/v1/analytics/sales-by-category` | `Admin` | `200` | 46ms | ✅ |
| `GET` | `/api/v1/analytics/sales-by-distributor` | `Admin` | `200` | 42ms | ✅ |
| `GET` | `/api/v1/analytics/dead-stock` | `Admin` | `200` | 111ms | ✅ |
| `GET` | `/api/v1/analytics/customer-ltv` | `Admin` | `200` | 98ms | ✅ |
| `GET` | `/api/v1/analytics/hourly-heatmap` | `Admin` | `200` | 16ms | ✅ |
| `GET` | `/api/v1/analytics/abc-classification` | `Admin` | `200` | 32ms | ✅ |
| `GET` | `/api/v1/analytics/reorder-suggestions` | `Admin` | `200` | 57ms | ✅ |
| `POST` | `/api/v1/analytics/inventory-snapshot` | `Admin` | `201` | 14ms | ✅ |
| `GET` | `/api/v1/analytics/inventory-snapshots` | `Admin` | `200` | 13ms | ✅ |
| `GET` | `/api/v1/reports/sales` | `Admin` | `200` | 51ms | ✅ |
| `GET` | `/api/v1/reports/inventory` | `Admin` | `200` | 28ms | ✅ |
| `GET` | `/api/v1/reports/profit-loss` | `Admin` | `200` | 39ms | ✅ |
| `GET` | `/api/v1/exports/products` | `Admin` | `200` | 18ms | ✅ |
| `GET` | `/api/v1/exports/sales` | `Admin` | `200` | 14ms | ✅ |
| `GET` | `/api/v1/exports/customers` | `Admin` | `200` | 22ms | ✅ |
| `GET` | `/api/v1/ai/forecast` | `Admin` | `200` | 42ms | ✅ |
| `GET` | `/api/v1/ai/recommendations` | `Admin` | `200` | 52ms | ✅ |
| `GET` | `/api/v1/ai/pricing-suggestions` | `Admin` | `200` | 116ms | ✅ |
| `GET` | `/api/v1/ai/churn-risk` | `Admin` | `200` | 40ms | ✅ |
| `GET` | `/api/v1/ai/anomalies` | `Admin` | `200` | 46ms | ✅ |
| `GET` | `/api/v1/notifications` | `Admin` | `200` | 14ms | ✅ |
| `GET` | `/api/v1/notifications/unread-count` | `Admin` | `200` | 4ms | ✅ |
| `PUT` | `/api/v1/notifications/1/read` | `Admin` | `200` | 4ms | ✅ |
| `PUT` | `/api/v1/notifications/read-all` | `Admin` | `200` | 6ms | ✅ |
