# MOON Fashion & Style — Feature & Enhancement Roadmap

> Generated from a full-system audit of the current codebase (Feb 2026).
> Each item is scored on **Priority** (High / Medium / Low) and **Complexity** (Simple / Medium / Complex).

---

## Table of Contents

| # | Title | Type | Priority | Complexity | Status |
|---|-------|------|----------|------------|--------|
| 1 | [Sale Refunds & Voids](#1-sale-refunds--voids) | New Feature | High | Medium | Done |
| 2 | [Receipt Printing & Reprint](#2-receipt-printing--reprint) | New Feature | High | Medium | Done |
| 3 | [Hold & Retrieve Cart](#3-hold--retrieve-cart) | New Feature | High | Medium | Done |
| 4 | [Low-Stock Alert Center](#4-low-stock-alert-center) | New Feature | High | Simple | Done |
| 5 | [Customer Purchase History](#5-customer-purchase-history) | Enhancement | High | Medium | Done |
| 6 | [Cost Price & Profit Margin Tracking](#6-cost-price--profit-margin-tracking) | New Feature | High | Complex | Done |
| 7 | [Stock Adjustment Log](#7-stock-adjustment-log) | New Feature | High | Medium | Done |
| 8 | [POS Keyboard Shortcuts](#8-pos-keyboard-shortcuts) | Enhancement | High | Simple | Done |
| 9 | [Cashier Performance Dashboard](#9-cashier-performance-dashboard) | New Feature | Medium | Medium | Done |
| 10 | [Product Image Support](#10-product-image-support) | Enhancement | Medium | Medium | Done |
| 11 | [Sales by Category / Distributor Analytics](#11-sales-by-category--distributor-analytics) | Enhancement | Medium | Medium | Done |
| 12 | [Bulk Product Operations](#12-bulk-product-operations) | Enhancement | Medium | Medium | Done |
| 13 | [Tax / VAT Support](#13-tax--vat-support) | New Feature | Medium | Complex | Done |
| 14 | [Customer Loyalty & Points System](#14-customer-loyalty--points-system) | New Feature | Medium | Complex | Done |
| 15 | [Analytics Export (PDF / CSV)](#15-analytics-export-pdf--csv) | Enhancement | Medium | Simple | Done |
| 16 | [Delivery Tracking Enhancements](#16-delivery-tracking-enhancements) | Enhancement | Medium | Complex | Done |
| 17 | [Product Variants (Size / Color)](#17-product-variants-size--color) | New Feature | Low | Complex | Done |
| 18 | [Purchase Orders from Distributors](#18-purchase-orders-from-distributors) | New Feature | Low | Complex | Done |
| 19 | [System Audit Log](#19-system-audit-log) | New Feature | Low | Medium | Done |
| 20 | [Notification Center](#20-notification-center) | New Feature | Low | Medium | Done |

---

## 1. Sale Refunds & Voids [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
There is **no way** to reverse a completed sale. If a customer returns an item or a cashier makes an error, the admin has no mechanism to correct it. Revenue figures become permanently inflated, and stock is never restored. This is a critical gap for any retail POS system.

### Proposed solution
Add a refund/void workflow to Sales History. An Admin can open any past sale, select full or partial refund, optionally restock items, and confirm. A new `refunds` table records the event. Revenue analytics are adjusted to show net revenue.

### Key functionality / acceptance criteria
- [ ] Admin can open any sale from Sales History and click "Refund"
- [ ] Partial refund: select specific items and quantities to refund
- [ ] Full refund: one-click refund for the entire sale
- [ ] Option to "restock items" (restores product stock) or not (damaged goods)
- [ ] Refund reason field (required: "Customer Return", "Cashier Error", "Defective", "Other")
- [ ] Refunded sales show a "Refunded" / "Partially Refunded" badge in the table
- [ ] Dashboard KPIs show net revenue (gross - refunds)
- [ ] Cannot refund a sale that has already been fully refunded
- [ ] Refund creates a negative entry, preserving the original sale record

### UI/UX considerations
- Refund dialog opens from the expanded sale row in Sales History
- Red "Refund" badge clearly distinguishes refunded sales
- Confirmation step with summary of items + amounts before finalizing
- Toast: "Refund of {amount} processed" / "تم استرداد {amount}"

### Technical notes
- **New DB table:** `refunds` (id, sale_id FK, amount, reason, items JSON, restock BOOLEAN, cashier_id FK, created_at)
- **New migration:** `009_create_refunds.sql`
- **New API endpoints:**
  - `POST /api/sales/:id/refund` — process refund
  - `GET /api/sales/:id/refunds` — list refunds for a sale
- **Modified:** `GET /api/sales` — include refund status
- **Modified:** `GET /api/analytics/dashboard` — net revenue calculation
- **Modified:** `SalesHistory.tsx` — refund button + dialog
- **New validator:** `refundSchema.ts`
- **i18n:** ~15 new keys (refund.title, refund.reason, refund.partial, etc.)

---

## 2. Receipt Printing & Reprint [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
After a sale, there is no receipt. Cashiers cannot provide customers with a printed or digital receipt. There is no way to reprint a receipt for a past sale. This is a fundamental retail requirement.

### Proposed solution
Generate a styled receipt after checkout (auto-popup or button). Allow reprinting any receipt from Sales History. Support both thermal printer format (80mm) and A4 printable layout. Optional: email receipt to customer.

### Key functionality / acceptance criteria
- [ ] After successful checkout, a receipt dialog opens with print option
- [ ] Receipt includes: store name/logo, date, items with qty + unit price, subtotal, discount, total, payment method, cashier name, sale ID
- [ ] "Print Receipt" button triggers browser print with receipt-optimized CSS
- [ ] Reprint from Sales History: "Print" icon on each sale row
- [ ] Receipt layout: 80mm thermal printer width (default), A4 option
- [ ] Receipt shows customer name if one was selected
- [ ] Arabic/English receipt based on current locale

### UI/UX considerations
- Receipt auto-shows after checkout (can be disabled in settings)
- Clean, minimal receipt design matching MOON branding (gold accents)
- Print-specific CSS hides all UI except receipt content
- Reprint icon in Sales History action column

### Technical notes
- **New component:** `client/src/components/Receipt.tsx` — receipt layout
- **New component:** `client/src/components/ReceiptDialog.tsx` — wrapper with print button
- **Modified:** `CartPanel.tsx` — show receipt after successful sale
- **Modified:** `SalesHistory.tsx` — add reprint button
- **CSS:** `@media print` rules for receipt formatting
- **settingsStore:** add `autoShowReceipt: boolean` preference
- **i18n:** ~10 new keys (receipt.title, receipt.reprint, receipt.thankYou, etc.)
- No backend changes needed — receipt uses existing sale data

---

## 3. Hold & Retrieve Cart [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
Cashiers can only work on one cart at a time. If a customer steps away or needs to check something, the cashier must either wait or lose the current cart. In busy retail, this blocks the checkout lane. The cart also clears on page refresh (not persisted).

### Proposed solution
Allow cashiers to "hold" the current cart (save it with a label), start a new empty cart, and retrieve any held cart later. Up to 5 held carts. Held carts persist across page refreshes.

### Key functionality / acceptance criteria
- [ ] "Hold Cart" button in CartPanel saves current items + discount to held carts list
- [ ] Optional label/note when holding (e.g., customer name)
- [ ] Cart clears after hold, ready for new customer
- [ ] "Held Carts" indicator shows count badge (e.g., "2 held")
- [ ] Click to open list of held carts with item count + total
- [ ] "Retrieve" loads a held cart back into active cart (replaces current)
- [ ] "Delete" removes a held cart
- [ ] Maximum 5 held carts (prevents abuse)
- [ ] Held carts persist via Zustand persist middleware
- [ ] Held carts auto-expire after 24 hours

### UI/UX considerations
- Hold button with pause icon next to cart title
- Held carts shown in a popover/dropdown, not a full dialog
- Badge on hold button shows count
- Retrieved cart shows toast: "Cart restored"
- Active cart is also persisted (survives page refresh)

### Technical notes
- **Modified:** `cartStore.ts` — add `heldCarts: HeldCart[]`, `holdCart()`, `retrieveCart(id)`, `deleteHeldCart(id)` + enable persist for active cart
- **Modified:** `CartPanel.tsx` — hold button, held carts popover
- **New type:** `HeldCart { id, label, items, discount, discountType, heldAt }`
- **i18n:** ~8 new keys (cart.hold, cart.retrieve, cart.heldCarts, cart.cartRestored, etc.)
- No backend changes — client-side only with localStorage persistence

---

## 4. Low-Stock Alert Center [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Simple

### Problem it solves
Products have a `min_stock` threshold, and the dashboard shows a "Low Stock Items" count, but there is **no way to see which products are low**. Admins must manually scan the inventory table. This delays restocking decisions and risks stockouts.

### Proposed solution
Add a dedicated low-stock alert view accessible from the dashboard KPI card. Show a filtered table of products where `stock <= min_stock`, with stock level, threshold, deficit, and distributor info. Optional: email/in-app notification when stock drops.

### Key functionality / acceptance criteria
- [ ] Dashboard "Low Stock Items" KPI card is clickable → navigates to `/inventory?filter=low-stock`
- [ ] Inventory page gains a "Low Stock" filter toggle/chip
- [ ] Low-stock table shows: product name, SKU, current stock, min_stock, deficit (min - current), category, distributor
- [ ] Sortable by deficit (worst first)
- [ ] New API endpoint: `GET /api/products/low-stock` — returns products where stock <= min_stock
- [ ] Optional: "Export Low Stock Report" as CSV

### UI/UX considerations
- Low-stock filter chip with warning icon in inventory page
- Deficit column uses red text for critical (stock = 0) and amber for warning
- Dashboard KPI card turns red/amber when count > 0
- Quick action: "Restock" button could pre-fill edit dialog

### Technical notes
- **New endpoint:** `GET /api/products/low-stock` in `server/routes/products.ts`
- **Modified:** `Dashboard.tsx` — make low-stock card clickable with `useNavigate`
- **Modified:** `Inventory.tsx` — add low-stock filter chip/toggle
- **Modified:** `GET /api/products` — add `lowStock=true` query param support
- **i18n:** ~5 new keys (inventory.lowStockFilter, inventory.deficit, inventory.restock, etc.)

---

## 5. Customer Purchase History [DONE]

**Type:** Enhancement
**Priority:** High
**Complexity:** Medium

### Problem it solves
Customers exist in the system but are **completely disconnected from sales data** in the UI. The `sales` table stores `customer_id` (via CartPanel checkout), but Sales History doesn't display it, and there's no way to view a customer's purchase history. This makes the customer data nearly useless for relationship management.

### Proposed solution
Surface customer info in Sales History. Add a "Purchase History" view to the Customers page. Link sales ↔ customers bidirectionally in the UI. Show lifetime stats per customer.

### Key functionality / acceptance criteria
- [ ] Sales History table shows customer name column (or "Walk-in" if null)
- [ ] Sales History gains a customer filter dropdown
- [ ] Customers page: clicking a customer row opens a detail panel/page
- [ ] Customer detail shows: total spent, number of orders, average order value, last purchase date
- [ ] Customer detail includes a table of their past sales (date, items count, total, payment)
- [ ] New API endpoint: `GET /api/customers/:id/sales` — paginated sales for a customer
- [ ] New API endpoint: `GET /api/customers/:id/stats` — aggregated stats

### UI/UX considerations
- Customer column in Sales History uses a subtle link style
- Customer detail could be a slide-over panel or a dedicated page
- Stats displayed as mini KPI cards at the top of the detail view
- "No purchases yet" empty state for new customers

### Technical notes
- **New endpoints:**
  - `GET /api/customers/:id/sales` — joins sales + sale_items where customer_id matches
  - `GET /api/customers/:id/stats` — aggregates (SUM total, COUNT, AVG, MAX created_at)
- **Modified:** `GET /api/sales` — include customer_name via JOIN
- **Modified:** `SalesHistory.tsx` — customer column + filter
- **Modified:** `Customers.tsx` — row click → detail view
- **New component:** `CustomerDetail.tsx` — stats + sales table
- **i18n:** ~12 new keys

---

## 6. Cost Price & Profit Margin Tracking [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Complex

### Problem it solves
The system only tracks selling price. There is **no cost/purchase price**, so the business cannot calculate profit margins, gross profit, or true ROI. The dashboard shows revenue but has no concept of profitability. This is a critical blind spot for business decisions.

### Proposed solution
Add `cost_price` to products. Calculate profit margin per product, per sale, and in aggregate on the dashboard. Add a profitability analytics section.

### Key functionality / acceptance criteria
- [ ] Products table gains `cost_price` column (REAL, default 0)
- [ ] Inventory form includes "Cost Price" field
- [ ] Product table shows margin % column: `((price - cost_price) / price) * 100`
- [ ] Sale items record `cost_price` at time of sale (snapshot, not live)
- [ ] Dashboard gains "Gross Profit" KPI card (revenue - cost)
- [ ] New analytics endpoint: `GET /api/analytics/profitability`
- [ ] Analytics shows: gross profit by day, margin by category, margin by product
- [ ] CSV import supports cost_price column

### UI/UX considerations
- Cost price field in inventory form (below selling price)
- Margin column uses color coding: green (>50%), amber (20-50%), red (<20%)
- Profitability chart on dashboard (separate section or toggle)
- Clearly labeled as "Gross Profit" (not net, since no expenses tracked)

### Technical notes
- **New migration:** `009_add_cost_price.sql` — `ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0`
- **Modified migration or new:** `ALTER TABLE sale_items ADD COLUMN cost_price REAL DEFAULT 0`
- **Modified:** product validator, product routes (create/update/import)
- **Modified:** sales route — snapshot cost_price into sale_items on create
- **New endpoint:** `GET /api/analytics/profitability`
- **Modified:** `Inventory.tsx` — cost price field + margin column
- **Modified:** `Dashboard.tsx` — gross profit KPI + chart
- **i18n:** ~10 new keys

---

## 7. Stock Adjustment Log [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
Stock changes happen silently. When a sale deducts stock or an admin manually edits stock via the product form, there's **no history**. If numbers don't add up, there's no way to trace what happened. This is an accountability and inventory accuracy issue.

### Proposed solution
Create a `stock_adjustments` table that logs every stock change with reason, quantity delta, and who made it. Show adjustment history per product and a global adjustment log page.

### Key functionality / acceptance criteria
- [ ] Every stock change is logged: sale (auto-deduct), manual edit, refund restock, CSV import
- [ ] Log entry includes: product_id, previous_qty, new_qty, delta, reason, user_id, timestamp
- [ ] Product detail/edit shows "Stock History" tab with adjustment log
- [ ] Standalone "Stock Adjustments" page for admins (global log, filterable by product/user/date)
- [ ] "Adjust Stock" button on inventory allows direct stock adjustment with reason
- [ ] Reasons: "Sale", "Manual Adjustment", "Refund Restock", "Import", "Damaged", "Stock Count"
- [ ] Cannot directly edit stock in product form anymore — must use adjustment flow

### UI/UX considerations
- Stock history shown as a timeline in product edit dialog (collapsible section)
- Global log uses DataTable with date, product, user, reason, delta columns
- Positive deltas shown in green (+5), negative in red (-3)
- "Adjust Stock" button in inventory action column (separate from edit)

### Technical notes
- **New DB table:** `stock_adjustments` (id, product_id FK, previous_qty, new_qty, delta, reason, user_id FK, created_at)
- **New migration:** `010_create_stock_adjustments.sql`
- **Modified:** `POST /api/sales` — log stock deduction
- **Modified:** `PUT /api/products/:id` — log manual stock changes
- **New endpoints:**
  - `GET /api/products/:id/stock-history`
  - `POST /api/products/:id/adjust-stock`
  - `GET /api/stock-adjustments` (global log)
- **New page or tab:** Stock Adjustments
- **i18n:** ~15 new keys

---

## 8. POS Keyboard Shortcuts [DONE]

**Type:** Enhancement
**Priority:** High
**Complexity:** Simple

### Problem it solves
Cashiers must use the mouse for every action in POS — searching, scanning, checkout, quantity changes. This slows down the checkout process significantly. Professional POS systems rely heavily on keyboard shortcuts.

### Proposed solution
Add keyboard shortcuts for common POS actions. Display a shortcut help overlay.

### Key functionality / acceptance criteria
- [ ] `F1` or `/` — focus search bar
- [ ] `F2` — open barcode scanner
- [ ] `F3` or `Enter` (when cart has items) — open checkout sheet
- [ ] `Escape` — close any open dialog/sheet/scanner
- [ ] `F8` — hold current cart
- [ ] `F9` — retrieve held cart
- [ ] `Delete` / `Backspace` — remove selected cart item
- [ ] `+` / `-` — increment/decrement quantity of last-added item
- [ ] `?` or `F12` — show keyboard shortcut help overlay
- [ ] Shortcuts only active on POS page (not globally)

### UI/UX considerations
- Small "Shortcuts" button or `?` icon in POS header
- Help overlay shows all shortcuts in a clean grid
- Shortcuts shown as subtle `kbd` badges next to relevant buttons
- Don't interfere with text input (disable shortcuts when input is focused)

### Technical notes
- **New hook:** `client/src/hooks/useKeyboardShortcuts.ts`
- **Modified:** `POS.tsx` — register shortcuts via hook
- **Modified:** `CartPanel.tsx` — expose focus/action methods
- **New component:** `KeyboardShortcutsHelp.tsx` — overlay dialog
- **i18n:** ~5 new keys (pos.shortcuts, pos.shortcutHelp, etc.)

---

## 9. Cashier Performance Dashboard [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
The admin has no visibility into cashier productivity. There's no way to see which cashier processes the most sales, has the highest average order value, or works the most hours. This limits management decision-making.

### Proposed solution
Add a "Staff Performance" analytics section to the dashboard or as a standalone page. Show per-cashier metrics: total sales, revenue, average order value, items per sale.

### Key functionality / acceptance criteria
- [ ] New analytics endpoints for cashier performance
- [ ] Table view: cashier name, total sales count, total revenue, avg order value, items per sale
- [ ] Date range filter (same as dashboard)
- [ ] Bar chart: revenue per cashier
- [ ] Comparison view: select two cashiers side-by-side
- [ ] Accessible only to Admin role

### UI/UX considerations
- Could be a new tab on the Dashboard or a standalone `/performance` page
- Use existing chart components (Recharts)
- Respect same date range as dashboard charts
- Cashier names as chart labels (truncated if too long)

### Technical notes
- **New endpoint:** `GET /api/analytics/cashier-performance` — GROUP BY cashier_id with aggregates
- **Modified or new page:** Dashboard tab or `Performance.tsx`
- **i18n:** ~8 new keys
- No DB changes — uses existing sales.cashier_id

---

## 10. Product Image Support [DONE]

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
Products have no images. In a fashion retail system, visual product identification is important — especially in POS where cashiers need to quickly identify items, and for future e-commerce expansion.

### Proposed solution
Add image upload to products. Store images on the server filesystem (or base64 in DB for simplicity). Display thumbnails in POS product grid, inventory table, and barcode labels.

### Key functionality / acceptance criteria
- [ ] Product form includes image upload field (drag & drop or click)
- [ ] Accept JPEG, PNG, WebP up to 2MB
- [ ] Image stored in `server/uploads/products/` directory
- [ ] Products table shows small thumbnail (40x40)
- [ ] POS product cards show product image (with fallback placeholder)
- [ ] Image can be changed or removed on edit
- [ ] CSV import doesn't include images (separate upload)

### UI/UX considerations
- Image preview in upload area before saving
- Fallback placeholder: stylized product icon or first letter of product name
- POS card images should be lazy-loaded for performance
- Thumbnail aspect ratio: square crop

### Technical notes
- **New migration:** add `image_url` column to products
- **New middleware:** `multer` for file upload handling
- **New endpoint:** `POST /api/products/:id/image` — upload image
- **New static route:** `app.use('/uploads', express.static('uploads'))`
- **Modified:** product routes, inventory form, POS grid
- **New package:** `multer` (Express file upload)
- Consider sharp for image resizing/thumbnailing

---

## 11. Sales by Category / Distributor Analytics [DONE]

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
The dashboard shows top products and payment methods, but there are **no insights by category or distributor**. The admin cannot answer: "Which category sells the most?", "Which distributor's products perform best?", or "What's the revenue split by category?"

### Proposed solution
Add category and distributor performance charts to the analytics dashboard. Show revenue, quantity sold, and margin breakdown by category and distributor.

### Key functionality / acceptance criteria
- [ ] New chart: "Revenue by Category" (pie or bar chart)
- [ ] New chart: "Revenue by Distributor" (bar chart)
- [ ] Both respect the dashboard date range filter
- [ ] Click a category/distributor segment to filter the top products chart
- [ ] API endpoints return aggregated data with date range support

### UI/UX considerations
- Add as new cards below existing dashboard charts
- Pie chart for category (usually < 15 categories)
- Horizontal bar chart for distributor (could be many)
- Color scheme: use existing gold palette with variations

### Technical notes
- **New endpoints:**
  - `GET /api/analytics/sales-by-category` — JOIN sale_items → products → categories
  - `GET /api/analytics/sales-by-distributor` — JOIN sale_items → products → distributors
- **Modified:** `Dashboard.tsx` — add 2 new chart sections
- **New chart components:** `CategorySalesChart.tsx`, `DistributorSalesChart.tsx`
- **i18n:** ~6 new keys

---

## 12. Bulk Product Operations [DONE]

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
Admins must edit products one at a time. Changing the category for 50 products, updating prices by 10%, or deleting discontinued items requires 50 individual operations. This is extremely time-consuming for inventory management.

### Proposed solution
Add row selection to the inventory DataTable. Enable bulk actions: delete, change category, change distributor, adjust price (fixed or percentage), export selected.

### Key functionality / acceptance criteria
- [ ] Checkbox column in inventory table for row selection
- [ ] "Select All" checkbox in header (current page)
- [ ] Bulk action toolbar appears when items are selected: "{count} selected"
- [ ] Bulk Delete — with confirmation dialog
- [ ] Bulk Change Category — dropdown selector
- [ ] Bulk Change Distributor — dropdown selector
- [ ] Bulk Price Adjust — percentage increase/decrease or fixed amount
- [ ] Bulk Export — CSV of selected products
- [ ] Referential integrity: bulk delete blocked if products have sale_items

### UI/UX considerations
- Sticky toolbar at top of table when items selected
- Clear "Deselect All" button
- Destructive actions (delete) require explicit confirmation
- Progress indicator for bulk operations (if > 20 items)

### Technical notes
- **New endpoints:**
  - `POST /api/products/bulk-delete` — body: `{ ids: number[] }`
  - `PUT /api/products/bulk-update` — body: `{ ids: number[], changes: Partial<Product> }`
- **Modified:** `DataTable.tsx` — add optional row selection support
- **Modified:** `Inventory.tsx` — bulk action toolbar + dialogs
- **i18n:** ~10 new keys

---

## 13. Tax / VAT Support [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Complex

### Problem it solves
The system has **no concept of tax**. In many jurisdictions, retail businesses must charge and report VAT/sales tax. Receipts must show tax breakdown. Without this, the system cannot be legally used in tax-regulated markets.

### Proposed solution
Add configurable tax rates (global default + per-category overrides). Calculate tax on checkout. Display tax on receipts and in sales reports. Support tax-inclusive and tax-exclusive pricing modes.

### Key functionality / acceptance criteria
- [ ] Global tax rate setting (e.g., 15% VAT)
- [ ] Per-category tax rate override (e.g., 0% for essentials)
- [ ] Tax calculation mode: inclusive (price includes tax) or exclusive (tax added on top)
- [ ] Cart shows subtotal, tax amount, and total separately
- [ ] Receipt shows tax breakdown
- [ ] Sales table stores tax_amount per sale
- [ ] Tax report: total tax collected by period
- [ ] "Tax Settings" section in a new Settings page (Admin only)

### UI/UX considerations
- Tax line item appears between subtotal and total in cart
- Settings page for tax configuration (simple form)
- Tax-exempt toggle per sale (for wholesale/diplomatic sales)
- Clear labeling: "VAT 15%" or "Tax-free" on receipts

### Technical notes
- **New DB table:** `tax_rates` (id, name, rate, applies_to, is_default, created_at)
- **New migration:** alter `sales` to add `tax_amount REAL DEFAULT 0`
- **New settings table** or use a `settings` key-value table
- **Modified:** `CartPanel.tsx` — tax calculation in checkout
- **Modified:** `POST /api/sales` — store tax_amount
- **New page:** `Settings.tsx` — tax configuration
- **New route + sidebar entry**
- **i18n:** ~15 new keys

---

## 14. Customer Loyalty & Points System [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Complex

### Problem it solves
There is no incentive for customers to return. No loyalty program means no repeat-customer tracking, no rewards, and no competitive differentiation. Fashion retail thrives on repeat customers.

### Proposed solution
Implement a points-based loyalty system. Customers earn points per purchase (e.g., 1 point per $1). Points can be redeemed as discounts on future purchases. Admin configures earn rate and redemption value.

### Key functionality / acceptance criteria
- [ ] Customers table gains `loyalty_points` column
- [ ] Points earned automatically when sale is linked to a customer
- [ ] Earn rate configurable (e.g., 1 point per $1 spent)
- [ ] Redemption rate configurable (e.g., 100 points = $5 discount)
- [ ] At checkout, if customer is selected, show available points and "Redeem" option
- [ ] Points deducted on redemption, added on purchase (net calculation)
- [ ] Points transaction log per customer (earned, redeemed, manual adjustment)
- [ ] Customer detail shows points balance and history
- [ ] Refunds deduct earned points

### UI/UX considerations
- Points balance shown next to customer name in CartPanel
- "Redeem Points" toggle/slider in checkout sheet
- Points history as a timeline in customer detail
- Gold star icon for loyalty badge
- "VIP" tier badges for top customers (visual only initially)

### Technical notes
- **New DB table:** `loyalty_transactions` (id, customer_id FK, sale_id FK, points, type, created_at)
- **New migration:** add `loyalty_points` to customers + create loyalty_transactions
- **New endpoints:**
  - `GET /api/customers/:id/loyalty`
  - `POST /api/customers/:id/loyalty/adjust` (manual admin adjustment)
- **Modified:** `POST /api/sales` — auto-earn points
- **Modified:** `CartPanel.tsx` — redemption UI
- **New settings:** earn rate, redemption rate
- **i18n:** ~15 new keys

---

## 15. Analytics Export (PDF / CSV) [DONE]

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Simple

### Problem it solves
Dashboard charts provide insights but cannot be shared or archived. Admins cannot email a weekly report, present data in meetings, or keep records. Only Sales History has CSV export; analytics charts have none.

### Proposed solution
Add export buttons to each dashboard chart section. Support CSV (data) and PDF (visual report with charts). Generate a full "Dashboard Report" PDF combining all charts and KPIs.

### Key functionality / acceptance criteria
- [ ] Each chart card has a small export icon (dropdown: CSV / PDF)
- [ ] CSV exports the raw data behind the chart
- [ ] "Export Full Report" button generates a multi-page PDF with all KPIs + charts
- [ ] PDF includes: date range, store name, all KPI values, all charts as images
- [ ] PDF respects current locale (Arabic or English)

### UI/UX considerations
- Small download icon in card header (unobtrusive)
- Full report export as a prominent button in dashboard header
- Loading state while PDF generates
- Filename includes date range: `MOON-Report-2026-02-01-to-2026-02-28.pdf`

### Technical notes
- **New package:** `jspdf` + `html2canvas` (or `@react-pdf/renderer` for server-side)
- **New utility:** `client/src/lib/exportReport.ts`
- **Modified:** chart components — add export button to card wrapper
- **Modified:** `Dashboard.tsx` — "Export Report" button
- **i18n:** ~5 new keys

---

## 16. Delivery Tracking Enhancements [DONE]

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Complex

### Problem it solves
Delivery tracking is basic — status only. There's no time tracking (how long each status lasted), no delivery proof, no route visualization, and no delivery performance metrics. This limits operations management.

### Proposed solution
Add status timestamps, estimated delivery time, delivery proof (notes + optional photo), and delivery performance metrics.

### Key functionality / acceptance criteria
- [ ] Each status change is timestamped (new `delivery_status_history` table)
- [ ] Estimated delivery time field on order creation
- [ ] Actual delivery time auto-calculated from status history
- [ ] Delivery completion: driver adds notes + optional photo
- [ ] Delivery performance metrics: on-time %, avg delivery time, orders per driver
- [ ] Status timeline view in order detail (visual progress bar)
- [ ] Late deliveries highlighted in red

### UI/UX considerations
- Status timeline as a horizontal stepper with timestamps
- Performance metrics as a card above the delivery table
- Late delivery badge: "Overdue" in red
- Photo upload for delivery proof (mobile-friendly)

### Technical notes
- **New DB table:** `delivery_status_history` (id, order_id FK, status, notes, photo_url, changed_by FK, created_at)
- **New migration**
- **Modified:** `PUT /api/delivery/:id/status` — create history entry
- **New endpoint:** `GET /api/delivery/:id/history` — status timeline
- **New endpoint:** `GET /api/analytics/delivery-performance`
- **Modified:** `Deliveries.tsx` — timeline view, performance cards
- **i18n:** ~12 new keys

---

## 17. Product Variants (Size / Color) [DONE]

**Type:** New Feature
**Priority:** Low
**Complexity:** Complex

### Problem it solves
Fashion products often come in multiple sizes and colors. Currently, each variant must be a separate product, cluttering the inventory. "Blue T-Shirt (S)" and "Blue T-Shirt (M)" are two unrelated entries. This makes inventory management and reporting inaccurate.

### Proposed solution
Introduce a parent-product / variant model. A product can have variant attributes (size, color, material). Each combination is a variant with its own SKU, barcode, stock, and price. POS shows the parent product with variant selection.

### Key functionality / acceptance criteria
- [ ] Products can be marked as "Has Variants"
- [ ] Variant attributes: configurable (Size, Color, Material, etc.)
- [ ] Each variant combination has: SKU, barcode, stock, price (can differ from parent)
- [ ] POS shows parent product → clicking opens variant selector
- [ ] Inventory shows parent products with total stock (sum of variants)
- [ ] Expand parent to see all variants
- [ ] Barcode scanning resolves to specific variant
- [ ] Reports aggregate by parent product with variant drill-down

### UI/UX considerations
- Variant selector in POS: size buttons + color swatches
- Inventory: expandable rows for parent products
- "Add Variant" button in product edit dialog
- Variant matrix view (size × color grid showing stock)

### Technical notes
- **New DB tables:** `product_variants`, `variant_attributes`, `variant_values`
- **Significant refactor** of product routes, POS, inventory, sales
- **Modified:** sale_items to reference variant_id instead of/alongside product_id
- **This is a large architectural change — plan carefully**

---

## 18. Purchase Orders from Distributors [DONE]

**Type:** New Feature
**Priority:** Low
**Complexity:** Complex

### Problem it solves
Restocking is entirely manual. There's no way to create purchase orders to distributors, track incoming inventory, or match received goods against orders. This is a key gap in the supply chain workflow.

### Proposed solution
Add a Purchase Orders module. Admin creates POs to distributors, specifying products + quantities. POs go through a workflow: Draft → Sent → Partially Received → Received. Receiving stock automatically adjusts inventory.

### Key functionality / acceptance criteria
- [ ] New page: Purchase Orders (`/purchase-orders`)
- [ ] Create PO: select distributor, add line items (product + qty + cost price)
- [ ] PO workflow: Draft → Sent → Partially Received → Received → Cancelled
- [ ] "Receive" action: mark items as received (partial or full)
- [ ] Receiving auto-adjusts product stock (and creates stock adjustment log entry)
- [ ] PO total calculation
- [ ] Filter by status, distributor, date
- [ ] Auto-generate PO from low-stock products

### UI/UX considerations
- Similar layout to Deliveries page
- Status chips with workflow colors
- "Auto-Generate PO" button analyzes low-stock items and pre-fills PO
- Receiving UI: quantity input per line item

### Technical notes
- **New DB tables:** `purchase_orders`, `purchase_order_items`
- **New routes:** `/api/purchase-orders` with full CRUD + receive endpoint
- **New page:** `PurchaseOrders.tsx`
- **New validator:** `purchaseOrderSchema.ts`
- **Integration:** stock adjustments logged on receive
- **Sidebar:** new nav item
- **i18n:** ~25 new keys

---

## 19. System Audit Log [DONE]

**Type:** New Feature
**Priority:** Low
**Complexity:** Medium

### Problem it solves
There is no record of who did what in the system. If a product price is changed, a user is deleted, or a sale is refunded, there's no trail. This is a security and compliance concern.

### Proposed solution
Log all significant actions to an `audit_log` table. Provide an Admin-only audit log viewer with filters.

### Key functionality / acceptance criteria
- [ ] Log entries for: login/logout, CRUD on products/users/customers/orders, sales, refunds, stock adjustments, settings changes
- [ ] Each entry: user_id, action, entity_type, entity_id, details (JSON), ip_address, timestamp
- [ ] Admin-only page: `/audit-log`
- [ ] Filters: by user, action type, entity type, date range
- [ ] Search by entity ID or detail text
- [ ] Entries are immutable (no delete/edit)

### UI/UX considerations
- DataTable with color-coded action types (create=green, update=blue, delete=red)
- Expandable rows to show full JSON details
- Date range filter
- No bulk actions (read-only table)

### Technical notes
- **New DB table:** `audit_log` (id, user_id FK, action, entity_type, entity_id, details JSON, ip_address, created_at)
- **New middleware:** `auditLogger.ts` — Express middleware or helper function
- **Instrument all existing routes** — add audit logging calls
- **New page + route + sidebar entry**
- **i18n:** ~10 new keys

---

## 20. Notification Center [DONE]

**Type:** New Feature
**Priority:** Low
**Complexity:** Medium

### Problem it solves
Important events happen silently: stock runs low, deliveries are overdue, offline sales need syncing. Admins must actively check each section to discover issues. There's no centralized alerting.

### Proposed solution
Add an in-app notification center (bell icon in sidebar/header). System-generated notifications for key events. Mark as read/unread. Optional: browser push notifications via the existing PWA service worker.

### Key functionality / acceptance criteria
- [ ] Bell icon in sidebar with unread count badge
- [ ] Notification dropdown/panel listing recent notifications
- [ ] Notification types: low stock alert, delivery overdue, offline sync completed, new sale (for admin)
- [ ] Mark individual or all as read
- [ ] Click notification navigates to relevant page
- [ ] Notifications stored server-side (new table)
- [ ] Optional browser push notifications (PWA)
- [ ] Configurable: Admin can toggle which notifications to receive

### UI/UX considerations
- Bell icon with red badge count
- Dropdown panel (not a full page) with scrollable list
- Notification items: icon, title, description, timestamp, unread dot
- "Mark all as read" button at top
- Empty state: "All caught up!"

### Technical notes
- **New DB table:** `notifications` (id, user_id FK, type, title, message, entity_type, entity_id, read, created_at)
- **New endpoints:**
  - `GET /api/notifications` — list for current user
  - `PUT /api/notifications/:id/read`
  - `PUT /api/notifications/read-all`
- **Server-side notification creation:** triggered by events in sales, stock, delivery routes
- **New component:** `NotificationCenter.tsx`
- **Modified:** `Sidebar.tsx` or `Layout.tsx` — bell icon
- **PWA:** push notification registration + display
- **i18n:** ~12 new keys

---

## Implementation Status

All 20 features from the original roadmap have been implemented. The system now includes:

- **Core POS**: Refunds, receipts, held carts, keyboard shortcuts, tax/VAT
- **Inventory**: Cost tracking, profit margins, stock adjustments, bulk operations, product images, variants
- **Analytics**: Cashier performance, category/distributor sales, PDF/CSV export
- **Customers**: Purchase history, loyalty points system
- **Operations**: Delivery tracking with shipping companies, purchase orders, audit log, notifications

---

*All features completed as of Feb 2026. This roadmap is now fully delivered.*
