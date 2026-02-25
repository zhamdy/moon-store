# API Reference

Base URL: `http://localhost:3001`

All endpoints return JSON in this format:

```json
// Success (single)
{ "success": true, "data": { ... } }

// Success (list)
{ "success": true, "data": [...], "meta": { "total": 100, "page": 1, "limit": 25 } }

// Error
{ "success": false, "error": "Human-readable message" }
```

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | Public | Login with email/password |
| POST | `/refresh` | Cookie | Refresh access token |
| POST | `/logout` | Cookie | Revoke refresh token |
| GET | `/me` | Bearer | Current user profile |

### Auth Flow

1. **Login**: `POST /api/auth/login` with `{ email, password }` → returns `{ accessToken }` + sets `refreshToken` as httpOnly cookie
2. **API calls**: `Authorization: Bearer <accessToken>` header (token expires in 15min)
3. **Token refresh**: `POST /api/auth/refresh` using cookie → new access token
4. **Role check**: Server middleware `requireRole('Admin')` checks `req.user.role`

### Token Details

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access token | 15 minutes | Client memory (`authStore`) |
| Refresh token | 7 days | httpOnly cookie |

---

## Products — `/api/products`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List products (paginated, searchable, filterable) |
| GET | `/categories` | Bearer | Distinct category list |
| GET | `/generate-sku/:categoryId` | Admin | Auto-generate next SKU |
| GET | `/generate-barcode` | Admin | Auto-generate EAN-13 barcode |
| GET | `/low-stock` | Admin | Products with stock <= min_stock |
| GET | `/barcode/:barcode` | Bearer | Lookup by barcode |
| GET | `/:id` | Bearer | Single product detail |
| GET | `/:id/variants` | Bearer | Product variants list |
| GET | `/:id/stock-history` | Admin | Stock adjustment log |
| GET | `/:id/price-history` | Admin | Price change history |
| POST | `/` | Admin | Create product (supports multer image upload) |
| PUT | `/:id` | Admin | Update product |
| PUT | `/:id/status` | Admin | Update status (active/inactive/discontinued) |
| DELETE | `/:id` | Admin | Soft delete (sets discontinued) |
| POST | `/import` | Admin | CSV bulk import |
| POST | `/bulk-delete` | Admin | Delete multiple products |
| PUT | `/bulk-update` | Admin | Update multiple products |
| POST | `/:id/adjust-stock` | Admin | Manual stock adjustment |
| POST | `/:id/image` | Admin | Upload product image |
| DELETE | `/:id/image` | Admin | Remove product image |
| POST | `/:id/variants` | Admin | Create variant |
| PUT | `/:id/variants/:variantId` | Admin | Update variant |
| DELETE | `/:id/variants/:variantId` | Admin | Delete variant |
| POST | `/batch-generate-barcodes` | Admin | Generate barcodes for multiple products |

---

## Sales — `/api/sales`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stats/summary` | Bearer | Today/month revenue + counts |
| GET | `/` | Bearer | List sales (date filters, pagination) + total revenue |
| GET | `/:id` | Bearer | Sale detail with line items |
| POST | `/` | Bearer | Create sale (deducts stock, supports split payments, coupons, loyalty) |
| POST | `/:id/refund` | Bearer | Full or partial refund (optional restock) |
| GET | `/:id/refunds` | Bearer | Refund history for a sale |
| POST | `/:id/send-receipt` | Bearer | Send receipt via email/SMS/WhatsApp |

---

## Delivery — `/api/delivery`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List orders (role-filtered for Delivery users) |
| GET | `/:id` | Bearer | Order with items |
| POST | `/` | Admin | Create delivery order |
| PUT | `/:id` | Admin | Update delivery order |
| PUT | `/:id/status` | Bearer | Update status (triggers SMS/WhatsApp) |
| GET | `/:id/history` | Admin | Status change history |
| GET | `/analytics/performance` | Admin | Delivery metrics (avg days, company stats) |

---

## Analytics — `/api/analytics`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/dashboard` | Admin | KPI cards (revenue, profit, orders, deliveries, low stock) |
| GET | `/revenue` | Admin | Revenue by date (default 30d, supports from/to query) |
| GET | `/top-products` | Admin | Top 10 products by qty sold |
| GET | `/payment-methods` | Admin | Payment method breakdown |
| GET | `/orders-per-day` | Admin | Daily order count trend |
| GET | `/cashier-performance` | Admin | Sales by cashier (count, revenue, avg order) |
| GET | `/sales-by-category` | Admin | Revenue by product category |
| GET | `/sales-by-distributor` | Admin | Revenue by distributor |
| GET | `/abc-classification` | Admin | Pareto A/B/C product classification |
| GET | `/reorder-suggestions` | Admin | Products needing reorder (velocity-based) |
| POST | `/inventory-snapshot` | Admin | Create point-in-time inventory snapshot |
| GET | `/inventory-snapshots` | Admin | List inventory snapshots |

---

## Users — `/api/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List all users |
| GET | `/delivery` | Admin | Delivery-role users only |
| POST | `/` | Admin | Create user |
| PUT | `/:id` | Admin | Update user |
| DELETE | `/:id` | Admin | Delete user |

---

## Customers — `/api/customers`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List customers (search, pagination) |
| GET | `/:id` | Admin | Customer detail with purchase history |
| POST | `/` | Admin | Create customer |
| PUT | `/:id` | Admin | Update customer |
| DELETE | `/:id` | Admin | Delete customer |

---

## Distributors — `/api/distributors`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List distributors |
| POST | `/` | Admin | Create distributor |
| PUT | `/:id` | Admin | Update distributor |
| DELETE | `/:id` | Admin | Delete distributor |

---

## Categories — `/api/categories`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List categories |
| POST | `/` | Admin | Create category |
| PUT | `/:id` | Admin | Update category |
| DELETE | `/:id` | Admin | Delete category |

---

## Stock Adjustments — `/api/stock-adjustments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List adjustments with filters |
| POST | `/` | Admin | Create adjustment (add/remove stock) |

---

## Purchase Orders — `/api/purchase-orders`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List purchase orders (paginated, filterable by status/distributor) |
| GET | `/auto-generate` | Admin | Suggest POs based on low-stock products |
| GET | `/:id` | Admin | PO detail with items |
| POST | `/` | Admin | Create PO (auto-generates PO-YYYYMMDD-XXX number) |
| PUT | `/:id/status` | Admin | Update PO status (Draft/Sent/Partially Received/Received/Cancelled) |
| POST | `/:id/receive` | Admin | Receive items (adjusts stock, auto-updates status) |
| DELETE | `/:id` | Admin | Delete PO (only if Draft) |

---

## Coupons — `/api/coupons`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List coupons |
| POST | `/` | Admin | Create coupon |
| PUT | `/:id` | Admin | Update coupon |
| DELETE | `/:id` | Admin | Delete coupon |
| POST | `/validate` | Bearer | Validate a coupon code |

---

## Gift Cards — `/api/gift-cards`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List gift cards |
| POST | `/` | Admin | Create gift card |
| PUT | `/:id` | Admin | Update gift card |
| POST | `/redeem` | Bearer | Redeem gift card balance |

---

## Bundles — `/api/bundles`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List product bundles |
| POST | `/` | Admin | Create bundle |
| PUT | `/:id` | Admin | Update bundle |
| DELETE | `/:id` | Admin | Delete bundle |

---

## Stock Counts — `/api/stock-counts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List stock count sessions |
| POST | `/` | Admin | Create stock count session |
| PUT | `/:id` | Admin | Update / finalize count |

---

## Reservations — `/api/reservations`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List stock reservations |
| POST | `/` | Admin | Create reservation |
| PUT | `/:id` | Admin | Update reservation |
| DELETE | `/:id` | Admin | Cancel reservation |

Expired reservations are cleaned up automatically every 5 minutes.

---

## Label Templates — `/api/label-templates`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List barcode label templates |
| POST | `/` | Admin | Create template |
| PUT | `/:id` | Admin | Update template |
| DELETE | `/:id` | Admin | Delete template |

---

## Cash Register — `/api/register`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List register sessions |
| POST | `/open` | Bearer | Open cash register |
| PUT | `/:id/close` | Bearer | Close register session |
| POST | `/:id/cash-in` | Bearer | Record cash in |
| POST | `/:id/cash-out` | Bearer | Record cash out |

---

## Exchanges — `/api/exchanges`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List exchanges |
| POST | `/` | Bearer | Create exchange |
| GET | `/:id` | Bearer | Exchange detail |

---

## Shifts — `/api/shifts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/current` | Bearer | Current active shift |
| GET | `/active` | Admin | All currently active shifts |
| GET | `/history` | Admin | Completed shifts (paginated, filterable) |
| GET | `/timesheet` | Admin | Aggregated hours by user |
| POST | `/clock-in` | Bearer | Clock in |
| POST | `/clock-out` | Bearer | Clock out (calculates total hours) |
| POST | `/start-break` | Bearer | Start break |
| POST | `/end-break` | Bearer | End break |

---

## Expenses — `/api/expenses`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List expenses (date filters) |
| POST | `/` | Admin | Create expense |
| PUT | `/:id` | Admin | Update expense |
| DELETE | `/:id` | Admin | Delete expense |

---

## Segments — `/api/segments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List customer segments |
| POST | `/` | Admin | Create segment |
| PUT | `/:id` | Admin | Update segment |
| DELETE | `/:id` | Admin | Delete segment |

---

## Layaway — `/api/layaway`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List layaway orders |
| POST | `/` | Bearer | Create layaway |
| GET | `/:id` | Bearer | Layaway detail |
| POST | `/:id/payment` | Bearer | Make layaway payment |
| PUT | `/:id/cancel` | Bearer | Cancel layaway |

---

## Collections — `/api/collections`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List season/collections |
| POST | `/` | Admin | Create collection |
| PUT | `/:id` | Admin | Update collection |
| DELETE | `/:id` | Admin | Delete collection |

---

## Warranty — `/api/warranty`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List warranty claims |
| POST | `/` | Admin | Create warranty claim |
| PUT | `/:id` | Admin | Update warranty status |

---

## Feedback — `/api/feedback`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List customer feedback |
| POST | `/` | Public | Submit feedback (NPS) |

---

## Branches — `/api/branches`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List store branches |
| POST | `/` | Admin | Create branch |
| PUT | `/:id` | Admin | Update branch |
| DELETE | `/:id` | Admin | Delete branch |

---

## Storefront — `/api/storefront`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/config` | Public | Get storefront configuration |
| PUT | `/config` | Admin | Update storefront config |
| GET | `/products` | Public | Public product listing |
| GET | `/products/:id` | Public | Public product detail |

---

## Online Orders — `/api/online-orders`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List online orders |
| POST | `/` | Public | Place online order |
| GET | `/:id` | Admin | Order detail |
| PUT | `/:id/status` | Admin | Update order status |

---

## Reports — `/api/reports`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List saved reports |
| POST | `/` | Admin | Create/save custom report |
| GET | `/:id` | Admin | Get report detail |
| POST | `/execute` | Admin | Execute report query |
| DELETE | `/:id` | Admin | Delete saved report |

---

## Vendors — `/api/vendors`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List marketplace vendors |
| POST | `/` | Admin | Create vendor |
| PUT | `/:id` | Admin | Update vendor |
| GET | `/:id` | Admin | Vendor detail |

---

## AI — `/api/ai`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/chat` | Admin | AI chatbot conversation |
| POST | `/describe` | Admin | Auto-generate product description |
| GET | `/predictions` | Admin | Sales predictions & trends |

---

## Shipping Companies — `/api/shipping-companies`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List shipping companies |
| POST | `/` | Admin | Create shipping company |
| PUT | `/:id` | Admin | Update shipping company |
| DELETE | `/:id` | Admin | Delete shipping company |

---

## Exports — `/api/exports`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List export history |
| POST | `/products` | Admin | Export products CSV/PDF |
| POST | `/sales` | Admin | Export sales CSV/PDF |
| POST | `/analytics` | Admin | Export analytics PDF |

---

## Settings — `/api/settings`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | Get system settings |
| PUT | `/` | Admin | Update system settings |

---

## Notifications — `/api/notifications`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Bearer | List user's notifications (supports `limit`, `unread_only` query) |
| GET | `/unread-count` | Bearer | Unread notification count |
| PUT | `/:id/read` | Bearer | Mark notification as read |
| PUT | `/read-all` | Bearer | Mark all as read |

---

## Audit Log — `/api/audit-log`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Admin | List entries (paginated; filter by user, action, entity_type, date range, search) |
| GET | `/actions` | Admin | Distinct action names |
| GET | `/entity-types` | Admin | Distinct entity types |

---

## Health — `/api/health`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Health check → `{ status: "ok", timestamp }` |

---

## Database Schema

### Core Tables

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `users` | id, name, email (unique), password_hash, role, created_at, last_login | Roles: Admin, Cashier, Delivery |
| `refresh_tokens` | id, user_id (FK), token, expires_at | JWT refresh tokens |
| `products` | id, name, sku (unique), barcode (unique), price, cost_price, stock, category, min_stock, image_url, status | Core product catalog |
| `product_variants` | id, product_id (FK), size, color, sku, barcode, stock, price | Size/color variants |
| `sales` | id, total, discount, discount_type, tax_amount, payment_method, cashier_id (FK), customer_id (FK), notes, tip | Sales transactions |
| `sale_items` | id, sale_id (FK), product_id (FK), quantity, unit_price | Line items per sale |
| `refunds` | id, sale_id (FK), amount, reason, items (JSON), restocked | Refund records |

### Inventory & Stock

| Table | Key Columns |
|-------|-------------|
| `categories` | id, name, parent_id, description |
| `distributors` | id, name, contact_name, phone, email, address |
| `stock_adjustments` | id, product_id, type, quantity, reason, user_id |
| `purchase_orders` | id, distributor_id, status, items, total |
| `stock_counts` | id, status, counted_by, items |
| `stock_reservations` | id, product_id, quantity, expires_at |
| `price_history` | id, product_id, old_price, new_price |

### Customers & Loyalty

| Table | Key Columns |
|-------|-------------|
| `customers` | id, name, phone, email, loyalty_points, total_spent |
| `customer_segments` | id, name, conditions (JSON) |
| `customer_feedback` | id, customer_name, rating, comment, nps_score |

### Operations

| Table | Key Columns |
|-------|-------------|
| `delivery_orders` | id, order_number, customer_name, phone, address, status, assigned_to, shipping_company_id |
| `delivery_items` | id, order_id, product_id, quantity |
| `shipping_companies` | id, name, tracking_url_template |
| `register_sessions` | id, user_id, opened_at, closed_at, opening_amount, closing_amount |
| `exchanges` | id, original_sale_id, new_sale_id, reason |
| `shifts` | id, user_id, clock_in, clock_out |
| `expenses` | id, category, amount, description, date |
| `layaway_orders` | id, customer_id, total, paid, status |

### Promotions & Commerce

| Table | Key Columns |
|-------|-------------|
| `coupons` | id, code, type, value, min_purchase, max_uses, expires_at |
| `gift_cards` | id, code, balance, original_amount |
| `bundles` | id, name, products (JSON), bundle_price |
| `collections` | id, name, season, year, products |

### Multi-Store & E-commerce

| Table | Key Columns |
|-------|-------------|
| `store_branches` | id, name, address, phone, is_main |
| `ecommerce_customers` | id, email, password_hash, name |
| `online_orders` | id, customer_id, items, total, status |
| `product_reviews` | id, product_id, customer_id, rating, comment |
| `storefront_config` | id, key, value |

### Marketplace & AI

| Table | Key Columns |
|-------|-------------|
| `vendors` | id, name, email, commission_rate, status |
| `vendor_products` | id, vendor_id, product_id, status |
| `vendor_commissions` | id, vendor_id, sale_id, amount |
| `vendor_reviews` | id, vendor_id, rating, comment |
| `smart_pricing_rules` | id, product_id, rule_type, config |
| `ai_conversations` | id, user_id, messages (JSON) |
| `sales_predictions` | id, product_id, predicted_qty, period |
| `auto_descriptions` | id, product_id, description |

### System

| Table | Key Columns |
|-------|-------------|
| `audit_log` | id, user_id, action, entity_type, entity_id, details, created_at |
| `notifications` | id, user_id, type, title, message, read, entity_type, entity_id |
| `settings` | id, key, value |
| `label_templates` | id, name, config (JSON) |
| `exports` | id, type, format, file_path, created_at |
| `offline_sync_queue` | id, action_type, payload (JSON), synced |
| `dashboard_widgets` | id, user_id, widget_type, position, config |
| `saved_reports` | id, name, query, filters |

### Migration History

- **Migrations 001-006**: Core schema (users, auth, products, sales, delivery, offline sync)
- **Migrations 007-020**: Wave 1 features (customers, categories, refunds, cost tracking, adjustments, images, tax, loyalty, delivery tracking, variants, POs, audit log, notifications)
- **Migrations 021-046**: Wave 2 features (shipping, status, delivery overhaul, notes/tips, favorites, split payments, price history, reservations, coupons, reorder, stock counts, snapshots, exports, gift cards, bundles, labels, multi-location, ABC classification, register, exchanges, shifts, expenses, layaway, collections, custom roles, warranty/feedback, commissions/activity)
- **Migrations 047-064**: Wave 3 features (branches, store performance, transfers, e-commerce, online orders, reviews, storefront, reports, data warehouse, widgets, vendors, vendor products/commissions/reviews, smart pricing, AI chatbot, predictions, auto descriptions)

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3001` | No | Server port |
| `JWT_SECRET` | — | **Yes** | Access token signing secret |
| `JWT_REFRESH_SECRET` | — | **Yes** | Refresh token signing secret |
| `CLIENT_URL` | `http://localhost:5173` | No | CORS origin |
| `ALLOWED_ORIGINS` | — | No | Comma-separated additional CORS origins |
| `NODE_ENV` | — | No | `production` hides error stack traces |
| `TWILIO_ACCOUNT_SID` | — | No | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | — | No | Twilio auth token |
| `TWILIO_PHONE` | — | No | Twilio SMS sender number |
| `TWILIO_WHATSAPP_FROM` | — | No | Twilio WhatsApp sender |

---

## Rate Limiting

### Global
- **Window**: 15 minutes
- **Max requests**: 200 per window per IP
- **Headers**: Standard rate-limit headers enabled
- **Response on limit**: `{ success: false, error: "Too many requests, please try again later" }`

### Login-Specific
- **Window**: 15 minutes
- **Max attempts**: 10 per window per IP
- Applied only to `POST /api/auth/login`

---

## Security Headers

Applied via `helmet`:
- Cross-Origin Resource Policy: `cross-origin` (allows image loading from `/uploads`)
- All other helmet defaults enabled (CSP, HSTS, X-Frame-Options, etc.)
