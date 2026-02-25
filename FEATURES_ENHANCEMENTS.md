# MOON Fashion & Style — Feature & Enhancement Proposals

> Generated: 2026-02-23
> Areas Analyzed: POS/Cart System, Inventory Management, Barcode Tools & Export

---

## Table of Contents

| # | Title | Type | Priority | Complexity | Status |
|---|-------|------|----------|------------|--------|
| **POS / Cart System** | | | | | |
| 1 | Split Payment Support | New Feature | High | Medium | Done |
| 2 | Coupon & Promo Code Engine | New Feature | High | Complex | Done |
| 3 | Quick-Add Favorites / Hotkeys Grid | New Feature | High | Simple | Done |
| 4 | Digital Receipt (Email / SMS / WhatsApp) | Enhancement | High | Medium | Done |
| 5 | Cart Auto-Save & Recovery | Enhancement | Medium | Simple | Done |
| 6 | Customer-Facing Display (Second Screen) | New Feature | Medium | Complex | Done |
| 7 | Sale Notes & Line-Item Memo | Enhancement | Medium | Simple | Done |
| 8 | Gift Card / Store Credit System | New Feature | Medium | Complex | Done |
| 9 | Product Bundles & Combo Deals | New Feature | Medium | Complex | Done |
| 10 | Tip / Gratuity at Checkout | Enhancement | Low | Simple | Done |
| **Inventory Management** | | | | | |
| 11 | Product Soft Delete & Discontinue Lifecycle | Enhancement | High | Simple | Done |
| 12 | Stock Reservation for Pending Orders | New Feature | High | Medium | Done |
| 13 | Price History & Margin Tracking Audit | New Feature | High | Medium | Done |
| 14 | Automated Reorder Point & PO Suggestions | New Feature | High | Complex | Done |
| 15 | Full Stock Count Workflow | New Feature | Medium | Medium | Done |
| 16 | Inventory Snapshots & Valuation Reports | New Feature | Medium | Medium | Done |
| 17 | Multi-Location Inventory | New Feature | Medium | Complex | Done |
| 18 | ABC / Pareto Inventory Classification | New Feature | Low | Medium | Done |
| **Barcode Tools & Export** | | | | | |
| 19 | Excel (XLSX) Export with Formatting | New Feature | High | Medium | Done |
| 20 | QR Code Generation & Scanning | New Feature | High | Medium | Done |
| 21 | Custom Barcode Label Template Designer | New Feature | Medium | Complex | Done |
| 22 | Batch Barcode Generation & Assignment | Enhancement | Medium | Medium | Done |
| 23 | Unified Export Center | New Feature | Medium | Medium | Done |

---

## POS / Cart System

---

### 1. Split Payment Support

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | High |
| **Complexity** | Medium |

**Problem it solves:**
Customers frequently want to pay using multiple methods (e.g., part cash + part card, or split between two cards). The current system only allows a single payment method per sale, forcing cashiers to either refuse split payments or perform manual workarounds like two separate sales — which distorts reporting and inventory.

**Proposed solution:**
Allow checkout to accept 1–N payment entries, each with a method and amount. The sum must equal the sale total. Backend validates split totals match and records each payment entry linked to the sale.

**Key functionality / acceptance criteria:**
- Checkout UI shows "Add Payment" button alongside payment method selection
- Each payment entry has: method (Cash / Card / Other), amount input
- Running "Remaining balance" counter updates in real-time
- Cannot submit if remaining balance != 0
- Sale record stores array of payments, not single method
- Receipt shows each payment method and amount
- Sales history and analytics support split payment reporting
- Existing single-payment flow unaffected (default behavior if only 1 entry)

**UI/UX considerations:**
- Default: single payment for full amount (no UX change for simple sales)
- "Split Payment" toggle or button reveals multi-payment UI
- Payment entries in a vertical list with remove button per entry
- Quick-fill button "Remaining" auto-fills remaining balance
- Color-coded remaining: green (exact), red (over/under)

**Technical notes:**
- New `sale_payments` table: `id, sale_id, method, amount, created_at`
- `sales.payment_method` becomes deprecated or stores primary method
- Backend validates `SUM(payments.amount) === sale.total`
- Update `saleSchema` to accept `payments: [{method, amount}]`
- Analytics queries join `sale_payments` instead of `sales.payment_method`
- CartPanel: new `payments[]` state, `addPayment()`, `removePayment()`

---

### 2. Coupon & Promo Code Engine

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | High |
| **Complexity** | Complex |

**Problem it solves:**
The current discount system is manual (cashier types a number). There's no way to run promotions, validate coupon codes, or track discount attribution. Marketing campaigns, seasonal sales, and customer retention programs have no system support.

**Proposed solution:**
A coupon management module where Admins create promo codes with rules (percentage/fixed, min purchase, valid dates, usage limits, category/product restrictions). At checkout, cashiers enter a code that auto-applies the discount with validation.

**Key functionality / acceptance criteria:**
- Admin CRUD for coupons: code, type (% / fixed), value, min purchase, max discount cap
- Date range validity (start/end)
- Usage limits: total uses, per-customer uses
- Scope: all products, specific categories, specific products
- Stackable flag (can combine with manual discount or not)
- Checkout: "Apply Coupon" input field, validates and shows discount
- Coupon usage tracked per sale (audit trail)
- Dashboard widget: active promotions, redemption count, revenue impact

**UI/UX considerations:**
- Coupon input field in checkout sheet, below discount section
- Green checkmark animation on valid code, red shake on invalid
- Applied coupon shows as pill/badge with "x" to remove
- Admin coupon list page with status indicators (Active/Expired/Depleted)

**Technical notes:**
- New tables: `coupons`, `coupon_usage` (sale_id, coupon_id, discount_applied)
- New route: `POST /api/coupons/validate` — checks all rules before applying
- `saleSchema` extended with optional `coupon_code`
- Sales route applies coupon discount after manual discount (or replaces it)
- React Query cache for coupon validation (short TTL)
- Admin page: new route `/promotions` or tab in existing settings

---

### 3. Quick-Add Favorites / Hotkeys Grid

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | High |
| **Complexity** | Simple |

**Problem it solves:**
Cashiers selling high-frequency items (e.g., top 10 bestsellers) must search or scroll every time. This slows down checkout, especially during rush hours. There's no way to pin frequently-sold products for instant one-tap access.

**Proposed solution:**
A configurable favorites grid (6–12 slots) pinned above or beside the product grid on the POS page. Each slot maps to a product with one-click add-to-cart. Cashiers can personalize their grid; Admins can set a default.

**Key functionality / acceptance criteria:**
- Favorites bar/grid visible at top of POS product area
- Each slot shows: product thumbnail, name (truncated), price
- Single click adds to cart immediately
- Long-press or edit mode allows drag-reorder and swap products
- Favorites persisted per user (localStorage or server-side per user)
- Admin can set "default favorites" for new users
- Empty slots show "+" to add a product via search dialog

**UI/UX considerations:**
- Compact horizontal strip or 2-row grid (responsive: 3 cols mobile, 6 desktop)
- Distinct visual style from product grid (e.g., gold border, smaller cards)
- Drag-and-drop reorder in edit mode
- Collapsible to save space when not needed

**Technical notes:**
- `user_preferences` table or extend `users` with JSON `preferences` column
- Store as array of product IDs: `favorites: [12, 5, 33, ...]`
- POS page: load favorites on mount, render above product grid
- New Zustand store `useFavoritesStore` with persist middleware (user-scoped key)
- Fallback: localStorage per user if no server-side preference API

---

### 4. Digital Receipt (Email / SMS / WhatsApp)

| Field | Detail |
|-------|--------|
| **Type** | Enhancement |
| **Priority** | High |
| **Complexity** | Medium |

**Problem it solves:**
Receipts can only be printed via browser `window.print()`. Customers who prefer paperless, or shops wanting to reduce paper costs, have no option. There's also no way to send receipts post-sale for returns or warranty claims.

**Proposed solution:**
After checkout, offer "Send Receipt" options: Email, SMS, or WhatsApp (Twilio already integrated). The receipt is rendered as HTML email or text message with sale summary. Also allow resending from Sales History.

**Key functionality / acceptance criteria:**
- Checkout completion shows: Print, Email, SMS, WhatsApp buttons
- Email: requires customer email (prompt if not on file)
- SMS/WhatsApp: uses customer phone (prompt if not on file)
- Receipt template: branded HTML for email, text summary for SMS
- Resend from Sales History detail view
- Receipt sent status tracked on sale record
- Settings page: toggle which channels are enabled

**UI/UX considerations:**
- Receipt dialog gains icon row: Printer, Mail, MessageSquare, Phone
- Email input auto-fills from customer record if selected
- Success toast: "Receipt sent to customer@email.com"
- Loading spinner while sending

**Technical notes:**
- Backend: `POST /api/sales/:id/send-receipt` with `{ channel, destination }`
- Email: integrate nodemailer or Twilio SendGrid
- SMS/WhatsApp: already have Twilio service — reuse `services/twilio.js`
- HTML email template in `server/templates/receipt.html` (Handlebars/EJS)
- `sales` table: add `receipt_sent_via` (nullable, comma-separated channels)
- Rate limit: max 3 sends per sale to prevent spam

---

### 5. Cart Auto-Save & Recovery

| Field | Detail |
|-------|--------|
| **Type** | Enhancement |
| **Priority** | Medium |
| **Complexity** | Simple |

**Problem it solves:**
If the browser crashes, tab closes, or page refreshes, the entire cart is lost. Cashiers must re-scan/re-add all items. The current `cartStore` has no persistence — only `heldCartsStore` persists.

**Proposed solution:**
Enable Zustand `persist` middleware on `cartStore` with a short debounce. Cart auto-saves to localStorage on every change. On POS page mount, if a saved cart exists, show a recovery prompt.

**Key functionality / acceptance criteria:**
- Cart state persists to localStorage on every change (debounced 500ms)
- On POS load, if persisted cart exists with items, show recovery banner
- Recovery banner: "You have an unsaved cart with X items. Restore? [Restore] [Discard]"
- Restore loads items back into cart
- Discard clears persisted state
- Held carts remain a separate feature (intentional save)
- Cart cleared after successful checkout (persisted state also cleared)

**UI/UX considerations:**
- Recovery banner at top of POS page (dismissible, amber/gold color)
- No modal — non-intrusive for fast cashiers
- Auto-dismiss after 30 seconds if no action (discard)

**Technical notes:**
- `cartStore`: add `persist` middleware with `name: 'moon-cart-recovery'`
- Add `lastUpdated` timestamp to detect stale carts (discard if > 8 hours)
- `clearCart()` also clears persisted storage
- POS page: `useEffect` on mount to check persisted state
- Minimal code change: ~20 lines in cartStore + ~30 lines recovery UI

---

### 6. Customer-Facing Display (Second Screen)

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Medium |
| **Complexity** | Complex |

**Problem it solves:**
Customers can't see what's being rung up, the running total, or promotional messages. This reduces transparency and trust. Retail environments often use a second screen (tablet/monitor) facing the customer.

**Proposed solution:**
A dedicated `/customer-display` route (no auth required, read-only) that mirrors the cart in real-time using WebSocket or BroadcastChannel API. Shows items, prices, running total, and optional promotional banners.

**Key functionality / acceptance criteria:**
- New route `/customer-display` — full-screen, kiosk-friendly layout
- Real-time sync with active POS cart (items, quantities, totals)
- Shows: line items with prices, discount, tax, grand total
- Customizable welcome message and promotional banner (from settings)
- Large fonts, high contrast, branded design
- Auto-hides sensitive info (cashier name, etc.)
- Works across tabs (BroadcastChannel) or devices (WebSocket)

**UI/UX considerations:**
- Large-format display: 48px+ fonts for totals
- MOON branding with elegant dark theme
- Animated item additions (slide-in)
- Idle state: show promotional slideshow or store logo
- RTL support for Arabic customers

**Technical notes:**
- Option A (same device): `BroadcastChannel('moon-pos-display')` — zero backend
- Option B (separate device): WebSocket server (`ws` or `socket.io`)
- New page component: `CustomerDisplay.tsx` with minimal state
- CartStore publishes changes to channel on every mutation
- Settings: `customer_display_message`, `customer_display_promo_images`
- Route excluded from auth middleware

---

### 7. Sale Notes & Line-Item Memo

| Field | Detail |
|-------|--------|
| **Type** | Enhancement |
| **Priority** | Medium |
| **Complexity** | Simple |

**Problem it solves:**
Cashiers have no way to attach notes to a sale (e.g., "Customer will pick up tomorrow") or to individual items (e.g., "Gift wrap requested", "Alteration: shorten 2 inches"). This context is lost and requires verbal communication.

**Proposed solution:**
Add an optional `notes` field to the sale and optional `memo` field per cart item. Both are free-text, visible in the receipt and sales history.

**Key functionality / acceptance criteria:**
- Checkout sheet: "Order Notes" text area (optional, max 500 chars)
- Cart item: small "Add note" link that expands to inline text input
- Notes saved with sale record and visible in sales detail
- Item memos saved with sale_items and visible in receipt
- Searchable in Sales History (search by note content)

**UI/UX considerations:**
- Notes field collapsed by default (click to expand)
- Line-item memo: small pencil icon, inline input below item name
- Receipt: notes section at bottom, item memos in italic below item line

**Technical notes:**
- `sales` table: add `notes TEXT` column
- `sale_items` table: add `memo TEXT` column
- Update `saleSchema`: add `notes: z.string().max(500).optional()`
- Update `saleItemSchema`: add `memo: z.string().max(200).optional()`
- CartStore: extend `CartItem` with `memo?: string`
- Sales history search: add `OR sales.notes LIKE ?` to WHERE clause

---

### 8. Gift Card / Store Credit System

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Medium |
| **Complexity** | Complex |

**Problem it solves:**
No way to sell or redeem gift cards. Luxury retail commonly uses gift cards for gifting, returns (store credit), and customer retention. Without this, the store loses a revenue stream and a marketing tool.

**Proposed solution:**
A gift card system where Admins can issue cards with a value, customers can redeem at checkout, and balances are tracked. Supports both physical (barcode-based) and digital cards.

**Key functionality / acceptance criteria:**
- Admin: create gift card with initial balance, optional expiry, and barcode
- POS: scan or enter gift card code to apply balance as payment
- Partial redemption supported (remaining balance preserved)
- Gift card as payment method in split payment
- Balance check via barcode scan or code lookup
- Issue gift card as refund option (store credit)
- Gift card history: all transactions per card
- Admin dashboard: total outstanding gift card liability

**UI/UX considerations:**
- Gift card entry field in checkout (alongside coupon)
- Balance display after code entry
- Gift card management page under Admin
- Physical card print template with barcode and PIN

**Technical notes:**
- New tables: `gift_cards` (id, code, barcode, balance, initial_value, expiry, status, customer_id), `gift_card_transactions` (id, card_id, sale_id, amount, type, created_at)
- New routes: `POST /api/gift-cards`, `GET /api/gift-cards/:code/balance`, `POST /api/gift-cards/:code/redeem`
- Integrate with split payment system (feature #1)
- Barcode generation reuses existing `/api/products/generate-barcode` logic

---

### 9. Product Bundles & Combo Deals

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Medium |
| **Complexity** | Complex |

**Problem it solves:**
No way to sell pre-defined product bundles at a discounted price (e.g., "Complete Outfit: Top + Bottom + Accessories for $150 instead of $180"). Bundles drive higher average order value and simplify purchasing for customers.

**Proposed solution:**
Admin creates bundles consisting of specific products/variants with a bundle price. At POS, adding a bundle adds all constituent items to the cart with the bundle discount automatically applied.

**Key functionality / acceptance criteria:**
- Admin CRUD for bundles: name, description, image, bundle price
- Bundle contains 2+ products with fixed quantities
- Savings displayed: original total vs. bundle price
- POS: bundles appear in product grid (filterable category or dedicated tab)
- Adding bundle adds all items to cart as a group
- Removing any bundle item removes entire bundle (or option to "unbundle")
- Bundle discount reflected in receipt and analytics
- Stock validation: all items must be in stock

**UI/UX considerations:**
- Bundle cards in POS: distinct design (e.g., "BUNDLE" badge, shows savings %)
- Cart: bundle items grouped with indentation, bundle name as header
- "Unbundle" option to convert to individual items at full price

**Technical notes:**
- New tables: `bundles` (id, name, price, image_url, status), `bundle_items` (id, bundle_id, product_id, variant_id, quantity)
- CartStore: new `addBundle()` action, items tagged with `bundle_id`
- Sale records: bundle_id on sale_items for attribution
- Stock check: validate all bundle items have sufficient stock before adding

---

### 10. Tip / Gratuity at Checkout

| Field | Detail |
|-------|--------|
| **Type** | Enhancement |
| **Priority** | Low |
| **Complexity** | Simple |

**Problem it solves:**
Some luxury retail stores and personal shopping services accept gratuity. There's no tip field at checkout, so tips are handled off-system, making accounting inaccurate.

**Proposed solution:**
Optional tip section in checkout with preset percentages and custom amount. Tip amount added to total and tracked separately from the sale amount.

**Key functionality / acceptance criteria:**
- Checkout sheet: "Add Tip" toggle (default off)
- Preset buttons: 10%, 15%, 20%, Custom
- Tip amount displayed separately in order summary
- Total = sale total + tip
- Tip tracked in `sales` table (separate column, not in `total`)
- Receipt shows tip line
- Tip reporting in analytics (optional)
- Feature toggle in settings (enabled/disabled)

**UI/UX considerations:**
- Tip section below payment method, above order summary
- Presets as pill buttons, custom opens amount input
- Subtle design — doesn't pressure customer

**Technical notes:**
- `sales` table: add `tip_amount REAL DEFAULT 0`
- `saleSchema`: add `tip: z.number().min(0).default(0)`
- CartPanel: new `tipAmount` state, preset calculations from subtotal
- Analytics: tip totals per cashier/day (for tip pooling)

---

## Inventory Management

---

### 11. Product Soft Delete & Discontinue Lifecycle

| Field | Detail |
|-------|--------|
| **Type** | Enhancement |
| **Priority** | High |
| **Complexity** | Simple |

**Problem it solves:**
Deleting a product is permanent and irreversible. If a product is out of season or temporarily unavailable, it must be deleted and recreated later. Historical sales data references a product ID that no longer exists, breaking reports. There's no concept of "discontinued" vs "active" products.

**Proposed solution:**
Add a `status` field to products with values: Active, Inactive, Discontinued. Instead of hard delete, products are set to Discontinued. Inactive products are hidden from POS but visible in inventory. Discontinued products are archived.

**Key functionality / acceptance criteria:**
- Product status: Active (default), Inactive (hidden from POS), Discontinued (archived)
- "Delete" button becomes "Discontinue" with confirmation
- Inventory page: filter by status (Active / Inactive / Discontinued / All)
- POS only shows Active products
- Inactive products retain full editing capability
- Discontinued products are read-only (can be reactivated)
- Sales history retains full product info regardless of status
- Bulk status change supported

**UI/UX considerations:**
- Status badge on product cards: green (Active), amber (Inactive), gray (Discontinued)
- Status dropdown in product edit dialog
- Inventory default filter: Active only (toggle to see all)
- Discontinued products grayed out with "Reactivate" button

**Technical notes:**
- `products` table: add `status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','discontinued'))`
- Products query: add `WHERE status = 'active'` for POS endpoint
- Inventory query: respect status filter parameter
- Existing DELETE route: change to SET status = 'discontinued'
- Add `PUT /api/products/:id/reactivate` route
- Migration: all existing products default to 'active'

---

### 12. Stock Reservation for Pending Orders

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | High |
| **Complexity** | Medium |

**Problem it solves:**
Stock is only decremented at sale completion. If two cashiers add the last item to their carts simultaneously, both see it as available, but only one sale can succeed — the other fails at checkout with "Insufficient stock". Delivery orders also don't reserve stock, causing overselling.

**Proposed solution:**
Implement soft stock reservation. When an item is added to cart or a delivery order is created, stock is temporarily reserved (decremented from "available" but not from "physical"). Reservations expire after a configurable timeout (e.g., 15 min for POS, 24h for delivery).

**Key functionality / acceptance criteria:**
- `available_stock = physical_stock - reserved_stock`
- POS and inventory show available stock (not physical)
- Adding to cart creates a reservation (backend API call)
- Reservation auto-expires after timeout
- Delivery order creation reserves stock
- Checkout converts reservation to sale (no double-deduction)
- Cart removal releases reservation
- Held carts maintain reservation (with longer timeout)
- Admin can view and manually release reservations

**UI/UX considerations:**
- Stock display: "5 available (2 reserved)" in inventory
- POS: seamless — shows available count, no UX change for cashier
- Warning toast if reservation fails (someone else got it first)

**Technical notes:**
- New table: `stock_reservations` (id, product_id, variant_id, quantity, source_type, source_id, expires_at, created_at)
- Background job: cron or setInterval to expire old reservations
- Product queries: `stock - COALESCE(SUM(reserved_qty), 0) AS available_stock`
- Cart API: `POST /api/reservations` on addItem, `DELETE /api/reservations/:id` on remove
- Sale route: convert reservation to sale_item, delete reservation

---

### 13. Price History & Margin Tracking Audit

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | High |
| **Complexity** | Medium |

**Problem it solves:**
When a product's price or cost changes, there's no historical record. Margin analysis only reflects current prices, not what margins were at the time of past sales. Bulk price adjustments have no audit trail. This makes financial analysis and pricing strategy unreliable.

**Proposed solution:**
Track every price/cost change with timestamp, user, and reason. Provide a price history timeline per product and margin trend charts in analytics.

**Key functionality / acceptance criteria:**
- Every price or cost_price change creates a history record
- History shows: old value, new value, change %, who changed it, when, reason
- Product detail view: "Price History" tab with timeline
- Bulk price changes logged per product
- Analytics: margin trend chart (avg margin over time)
- Export price history as CSV
- Alert when margin drops below threshold (configurable)

**UI/UX considerations:**
- Price history as accordion or timeline in product edit dialog
- Margin trend: line chart in analytics dashboard
- Color-coded changes: green (increase), red (decrease)

**Technical notes:**
- New table: `price_history` (id, product_id, field ('price'|'cost_price'), old_value, new_value, user_id, reason, created_at)
- Trigger on product UPDATE: compare old/new price/cost, insert history
- New route: `GET /api/products/:id/price-history`
- Analytics route: `GET /api/analytics/margin-trend`
- Bulk update route: create history entry per affected product

---

### 14. Automated Reorder Point & PO Suggestions

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | High |
| **Complexity** | Complex |

**Problem it solves:**
The `min_stock` field triggers notifications but doesn't suggest what to order or how much. Admins must manually calculate reorder quantities, check sales velocity, and create purchase orders. This is time-consuming and error-prone, leading to stockouts or overstock.

**Proposed solution:**
Calculate reorder suggestions based on sales velocity (units sold per day) and lead time. Auto-generate draft purchase orders for distributor review. Integrate with the existing purchase orders module.

**Key functionality / acceptance criteria:**
- Products have configurable `lead_time_days` and `reorder_qty` fields
- System calculates: `safety_stock = avg_daily_sales × lead_time × 1.5`
- Suggestion triggers when: `available_stock <= safety_stock`
- Dashboard widget: "Reorder Suggestions" with product list
- One-click: convert suggestion to draft purchase order (existing PO module)
- Group suggestions by distributor for efficient ordering
- Weekly email digest of reorder suggestions (optional)
- Manual override: Admin can dismiss or adjust suggestions

**UI/UX considerations:**
- Dashboard card: "X products need reordering" with link to detail
- Reorder suggestions page: table with product, current stock, daily velocity, suggested qty, distributor
- "Create PO" button per distributor grouping
- Color urgency: red (critical, <3 days), amber (soon, <7 days), green (healthy)

**Technical notes:**
- `products` table: add `lead_time_days INTEGER DEFAULT 7`, `reorder_qty INTEGER`
- New route: `GET /api/inventory/reorder-suggestions`
- Query: avg sales/day from `sale_items` over last 30 days per product
- Integrate with `POST /api/purchase-orders` (existing module)
- Scheduled job: daily calculation cached in `reorder_suggestions` table
- Email: nodemailer with digest template

---

### 15. Full Stock Count Workflow

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Medium |
| **Complexity** | Medium |

**Problem it solves:**
The "Stock Count" reason exists in stock adjustments, but there's no formal counting workflow. Physical inventory counts require manual comparison of system stock vs. actual stock, one product at a time. This is slow and error-prone for stores with hundreds of products.

**Proposed solution:**
A dedicated stock count workflow: create a count session, scan/enter products with actual quantities, system calculates discrepancies, review and approve adjustments in bulk.

**Key functionality / acceptance criteria:**
- Create "Stock Count" session (full inventory or by category)
- Count interface: scan barcode or search product, enter actual quantity
- System shows: expected qty, counted qty, discrepancy (+/-)
- Products not yet counted highlighted
- Save progress (resume later)
- Review screen: all discrepancies with approve/reject per product
- Approve: creates stock adjustments for all approved discrepancies
- Count history: past counts with summary (shrinkage, overage)
- Lock inventory during count (optional: prevent sales during count)

**UI/UX considerations:**
- Mobile-friendly counting interface (designed for handheld scanners)
- Large barcode scan area + numeric keypad for quantity
- Progress bar: "45/200 products counted"
- Discrepancy list: sortable by magnitude
- Approval screen: checkbox per item, "Approve All" button

**Technical notes:**
- New tables: `stock_counts` (id, status, category_id, started_by, started_at, completed_at), `stock_count_items` (id, count_id, product_id, expected_qty, actual_qty, approved)
- New routes: CRUD for `/api/stock-counts`, `POST /api/stock-counts/:id/approve`
- Approval creates bulk `stock_adjustments` entries
- New page: `/stock-count` with mobile-optimized layout

---

### 16. Inventory Snapshots & Valuation Reports

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Medium |
| **Complexity** | Medium |

**Problem it solves:**
No way to see what the inventory looked like at a past date. Financial reporting requires inventory valuation (cost × quantity for all products) at period-end. Currently, only the current state is available — any historical view requires manual calculation from stock adjustment logs.

**Proposed solution:**
Automated daily inventory snapshots capturing stock levels and valuations. Admin can view snapshots for any past date with totals by category, distributor, and overall. Supports FIFO/weighted average cost methods.

**Key functionality / acceptance criteria:**
- Daily automated snapshot of all product stock and cost values
- Snapshot stores: product_id, stock, cost_price, total_value (stock × cost)
- Admin view: select date, see full inventory state at that date
- Summary: total units, total value, value by category, value by distributor
- Compare two dates: show changes (growth/shrinkage)
- Export snapshot as CSV/XLSX
- Retention: 365 days of daily snapshots

**UI/UX considerations:**
- New "Reports" page or tab in Analytics
- Date picker to select snapshot date
- Summary cards: total SKUs, total units, total value
- Comparison mode: two date pickers, delta column

**Technical notes:**
- New table: `inventory_snapshots` (id, date, product_id, stock, cost_price, value, category_id)
- Scheduled job: nightly snapshot creation (iterate all products)
- New route: `GET /api/reports/inventory-snapshot?date=YYYY-MM-DD`
- Storage optimization: only store changes (delta snapshots) if data grows large
- Export route: `GET /api/reports/inventory-snapshot/export?date=...&format=xlsx`

---

### 17. Multi-Location Inventory

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Medium |
| **Complexity** | Complex |

**Problem it solves:**
The system assumes a single store/warehouse. If the business expands to multiple locations, there's no way to track stock per location, transfer between locations, or report per-location sales.

**Proposed solution:**
Introduce a `locations` table. Each product's stock is tracked per location. POS is scoped to a location. Transfers between locations are tracked. Reports can filter by location.

**Key functionality / acceptance criteria:**
- Locations CRUD (name, address, type: Store/Warehouse)
- Product stock tracked per location (pivot table)
- POS scoped to user's assigned location
- Stock transfers: source location, destination, products, quantities
- Transfer approval workflow (optional)
- Inventory page: filter by location
- Analytics: per-location sales, revenue, top products
- Barcode scan shows stock at current location

**UI/UX considerations:**
- Location selector in header/sidebar
- Inventory columns: "Stock (This Location)" and "Stock (All Locations)"
- Transfer UI: select products, quantities, destination — wizard format

**Technical notes:**
- New tables: `locations`, `product_locations` (product_id, location_id, stock), `stock_transfers`
- `users` table: add `location_id` FK
- Product queries: JOIN product_locations with user's location
- Sale: deduct from specific location stock
- Migration: create default "Main Store" location, move all stock to it

---

### 18. ABC / Pareto Inventory Classification

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Low |
| **Complexity** | Medium |

**Problem it solves:**
No insight into which products contribute most to revenue (A items), moderately (B items), or least (C items). Without ABC classification, the store may over-invest in managing slow-moving inventory while under-managing critical bestsellers.

**Proposed solution:**
Automated ABC classification based on sales revenue contribution. A = top 20% of products contributing ~80% revenue, B = next 30% contributing ~15%, C = remaining 50% contributing ~5%. Displayed in inventory and analytics.

**Key functionality / acceptance criteria:**
- Automated classification based on last 90 days of sales data
- Products tagged: A (gold), B (silver), C (bronze)
- Classification visible in inventory table as badge
- Analytics chart: Pareto curve (cumulative revenue % vs. product rank)
- Filter inventory by classification
- Recalculation: nightly or on-demand
- Recommendations: "Consider discontinuing" for C items with zero sales

**UI/UX considerations:**
- Classification badge in inventory product row
- Analytics: Pareto chart with A/B/C zones marked
- Dashboard widget: "A-class items running low" alert

**Technical notes:**
- Calculation: rank products by SUM(sale_items.unit_price × quantity), assign A/B/C
- Store in `products.abc_class` or separate `product_classifications` table
- New route: `GET /api/analytics/abc-classification`
- Nightly job or on-demand: `POST /api/analytics/recalculate-abc`
- Dashboard integration: alert when A-class items below min_stock

---

## Barcode Tools & Export

---

### 19. Excel (XLSX) Export with Formatting

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | High |
| **Complexity** | Medium |

**Problem it solves:**
All exports are plain CSV — no formatting, no formulas, no multi-sheet support. Business users expect Excel files with headers, column widths, currency formatting, and summary rows. CSV files require manual formatting every time they're opened.

**Proposed solution:**
Add XLSX export option alongside CSV across all export points (inventory, sales, analytics, barcode lists). Generated files include formatted headers, auto-sized columns, number/currency formatting, and optional summary rows with formulas.

**Key functionality / acceptance criteria:**
- XLSX export button alongside existing CSV export everywhere
- Formatted headers: bold, colored background, frozen row
- Auto-column width based on content
- Currency columns formatted with locale-aware currency symbol
- Date columns formatted as date
- Summary row at bottom: totals for numeric columns (SUM formula)
- Multi-sheet for complex exports (e.g., Dashboard: Revenue sheet + Products sheet + Payments sheet)
- Inventory export: includes stock status coloring (red/amber/green)
- File naming: `{module}-export-{YYYY-MM-DD}.xlsx`

**UI/UX considerations:**
- Export dropdown: "Export as CSV" / "Export as Excel"
- Same button location, added format picker
- Loading indicator during XLSX generation (heavier than CSV)

**Technical notes:**
- Install `exceljs` or `xlsx` (SheetJS) package — client-side generation
- `exceljs` preferred: better styling support, MIT license
- New utility: `lib/exportXlsx.ts` with `exportToXlsx(filename, sheets[])`
- Each sheet: `{ name, columns: [{header, key, width, format}], data[] }`
- Client-side Blob generation + download (no server endpoint needed)
- Inventory page: update bulk export to use format picker
- Dashboard: update all export buttons
- Barcode Tools: add XLSX export for bulk product list with barcode column

---

### 20. QR Code Generation & Scanning

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | High |
| **Complexity** | Medium |

**Problem it solves:**
Only 1D barcodes (EAN, CODE128) are supported. QR codes are increasingly used in retail for product URLs, digital receipts, promotional links, and mobile payments. The scanner only reads linear barcodes — no 2D barcode support.

**Proposed solution:**
Add QR code generation for products (linking to product detail or custom data) and receipt QR (linking to digital receipt). Extend scanner to detect QR codes alongside barcodes.

**Key functionality / acceptance criteria:**
- Generate QR code per product (encoding: product URL, barcode, or custom data)
- QR code visible in Barcode Tools generator tab
- Bulk QR code print (like existing bulk barcode print)
- Receipt QR code: encodes sale ID or receipt URL
- Scanner detects QR codes (Quagga2 alternative or supplement)
- QR code on printed receipt for easy return lookup
- Admin setting: QR data format (URL, product ID, JSON)

**UI/UX considerations:**
- Generator tab: toggle between "Barcode" and "QR Code" view
- QR code preview with download button (PNG/SVG)
- Bulk print: option to print QR codes instead of/alongside barcodes
- Receipt: small QR code in footer area

**Technical notes:**
- Install `qrcode` package (Node.js) or `qrcode.react` (client-side)
- Quagga2 has limited QR support — consider `html5-qrcode` or `zxing-js` as supplement
- BarcodeGenerator component: add format prop ('barcode' | 'qr')
- New component: `QRCodeGenerator.tsx` using `qrcode.react`
- Scanner hook: initialize secondary QR detector if QR mode enabled
- Receipt component: add QR code image encoding sale lookup URL

---

### 21. Custom Barcode Label Template Designer

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Medium |
| **Complexity** | Complex |

**Problem it solves:**
Barcode printing uses a hardcoded HTML layout. Different label printers use different label sizes (e.g., 30mm×20mm, 50mm×25mm, Dymo, Brother). Stores want custom label designs with different info (some want price, some don't; some want brand logo).

**Proposed solution:**
A label template designer where Admin configures label dimensions, selects which fields to include, and arranges layout. Templates are saved and selectable during bulk print.

**Key functionality / acceptance criteria:**
- Admin template editor: drag-and-drop fields onto label canvas
- Available fields: barcode, QR code, product name, SKU, price, category, custom text, logo
- Label size presets: common label printer sizes + custom dimensions
- Field properties: font size, bold, position, alignment
- Save multiple templates (e.g., "Price Tag", "Shelf Label", "Shipping Label")
- Bulk print uses selected template
- Template preview with sample data
- Print dialog respects template dimensions (CSS @page size)

**UI/UX considerations:**
- Visual canvas editor with grid snapping
- Drag fields from sidebar onto label area
- Live preview with actual product data
- Preset library: "Jewelry Tag", "Clothing Hang Tag", "Shelf Price", etc.

**Technical notes:**
- Template stored as JSON: `{ width, height, unit, fields: [{type, x, y, w, h, fontSize, ...}] }`
- New table: `label_templates` (id, name, template_json, is_default, created_at)
- Rendering engine: HTML/CSS with absolute positioning inside sized container
- Print: CSS `@page { size: Xmm Ymm; }` for precise label dimensions
- Canvas editor: consider `react-draggable` + `react-resizable` or simple CSS grid editor
- Alternative (simpler): predefined layout options instead of full designer

---

### 22. Batch Barcode Generation & Assignment

| Field | Detail |
|-------|--------|
| **Type** | Enhancement |
| **Priority** | Medium |
| **Complexity** | Medium |

**Problem it solves:**
Barcodes must be generated one at a time via the product create dialog. Products imported via CSV often lack barcodes. There's no way to bulk-generate and assign barcodes to products that don't have one, or to regenerate barcodes for a range of products.

**Proposed solution:**
A batch operation in Barcode Tools that identifies products without barcodes, generates EAN-13 codes, and assigns them in bulk. Also supports regenerating barcodes for selected products.

**Key functionality / acceptance criteria:**
- "Products Without Barcodes" view: table of products missing barcode field
- "Generate All" button: auto-generates EAN-13 for all selected products
- Preview before applying: show product name + proposed barcode
- Apply: bulk UPDATE products with generated barcodes
- Collision detection: verify generated barcodes don't conflict with existing
- Also supports variants without barcodes
- Audit log: tracks bulk barcode assignments
- Option to choose format: EAN-13, CODE128, UPC-A

**UI/UX considerations:**
- New tab or section in Barcode Tools: "Batch Assign"
- Table with checkboxes: product name, SKU, current barcode (empty), proposed barcode
- "Generate" fills proposed column, "Apply" saves to database
- Progress bar for large batches

**Technical notes:**
- Reuse `/api/products/generate-barcode` logic in batch mode
- New route: `POST /api/products/batch-generate-barcodes` with `{ product_ids[], format }`
- Server generates, checks uniqueness, bulk updates in transaction
- Client: new tab in BarcodeTools with product table (filter: `barcode IS NULL`)
- Existing `bulkUpdateMutation` pattern extended for barcode assignment

---

### 23. Unified Export Center

| Field | Detail |
|-------|--------|
| **Type** | New Feature |
| **Priority** | Medium |
| **Complexity** | Medium |

**Problem it solves:**
Export functionality is scattered across 5+ different pages (inventory, sales, dashboard, barcode tools), each with slightly different implementations. Some use `exportUtils.ts`, some use inline Blob creation, some use print windows. There's no central place to find or schedule exports.

**Proposed solution:**
A dedicated Export Center page where users can generate, schedule, and download exports for any module. Standardized export with consistent format options (CSV, XLSX, PDF) and saved export presets.

**Key functionality / acceptance criteria:**
- Export Center page accessible from sidebar
- Module selector: Inventory, Sales, Analytics, Barcode Labels
- Filter configuration per module (date range, category, status, etc.)
- Format selector: CSV, XLSX, PDF
- Column picker: choose which fields to include
- "Export Now" generates and downloads immediately
- Export presets: save common configurations ("Monthly Sales Report")
- Export history: list of recent exports with re-download
- Scheduled exports (optional): daily/weekly auto-generation

**UI/UX considerations:**
- Wizard-style: Step 1 (Module) → Step 2 (Filters) → Step 3 (Format & Columns) → Generate
- Presets as cards for one-click repeat exports
- Export history table with status, file size, download link

**Technical notes:**
- Backend: `POST /api/exports/generate` with `{ module, filters, format, columns }`
- Server-side generation for large datasets (prevents browser memory issues)
- `exports` table: id, module, filters_json, format, file_path, user_id, created_at
- File storage: `/server/exports/{timestamp}-{module}.{format}`
- Cleanup: auto-delete exports older than 30 days
- Shared export engine: single codebase for CSV/XLSX/PDF generation
- Client: new page `/exports` with React Query for export history

---

## Priority Matrix

```
                    HIGH IMPACT
                        |
     ┌──────────────────┼──────────────────┐
     │  #1 Split Pay    │  #2 Coupons      │
     │  #3 Favorites    │  #14 Auto-Reorder│
     │  #4 Digital Rcpt │  #8 Gift Cards   │
     │  #11 Soft Delete │  #9 Bundles      │
     │  #19 XLSX Export │  #6 Cust Display │
     │  #12 Reservations│  #17 Multi-Loc   │
EASY ─┤  #13 Price Hist │──────────────────├─ HARD
     │  #5 Cart Recover │  #21 Label Design│
     │  #7 Sale Notes   │  #15 Stock Count │
     │  #10 Tips        │  #16 Snapshots   │
     │  #20 QR Codes    │  #23 Export Ctr  │
     │  #22 Batch Bcode │  #18 ABC Class   │
     └──────────────────┼──────────────────┘
                        |
                    LOW IMPACT
```

## Recommended Implementation Order

### Phase 1 — Quick Wins (1–2 weeks each)
1. **#11** Product Soft Delete & Lifecycle
2. **#5** Cart Auto-Save & Recovery
3. **#7** Sale Notes & Memo
4. **#3** Quick-Add Favorites Grid
5. **#10** Tip at Checkout

### Phase 2 — High-Value Features (2–4 weeks each)
6. **#19** Excel (XLSX) Export
7. **#1** Split Payment Support
8. **#4** Digital Receipt
9. **#13** Price History & Margin Audit
10. **#22** Batch Barcode Generation
11. **#20** QR Code Support

### Phase 3 — Strategic Features (3–6 weeks each)
12. **#12** Stock Reservation
13. **#2** Coupon & Promo Engine
14. **#14** Automated Reorder & PO Suggestions
15. **#15** Stock Count Workflow
16. **#16** Inventory Snapshots

### Phase 4 — Advanced (4–8 weeks each)
17. **#23** Unified Export Center
18. **#8** Gift Card System
19. **#9** Product Bundles
20. **#6** Customer-Facing Display
21. **#21** Label Template Designer
22. **#17** Multi-Location Inventory
23. **#18** ABC Classification
