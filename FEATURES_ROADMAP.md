# MOON Fashion & Style — Feature & Enhancement Roadmap

> Generated from a full-system audit of the current codebase (Feb 2026).
> Each item is scored on **Priority** (High / Medium / Low) and **Complexity** (Simple / Medium / Complex).

---

## Table of Contents

### Wave 1 (Completed)

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

### Wave 2 (Completed)

| # | Title | Type | Priority | Complexity | Status |
|---|-------|------|----------|------------|--------|
| 21 | [Cash Register / Drawer Management](#21-cash-register--drawer-management) | New Feature | High | Medium | Done |
| 22 | [Exchange Workflow](#22-exchange-workflow) | New Feature | High | Medium | Done |
| 23 | [Employee Shift & Time Tracking](#23-employee-shift--time-tracking) | New Feature | High | Medium | Done |
| 24 | [Expense Tracking & P&L Statement](#24-expense-tracking--pl-statement) | New Feature | High | Medium | Done |
| 25 | [Customer Segmentation & RFM Analysis](#25-customer-segmentation--rfm-analysis) | New Feature | High | Medium | Done |
| 26 | [Layaway / Credit Sale / Pay Later](#26-layaway--credit-sale--pay-later) | New Feature | High | Complex | Done |
| 27 | [Season / Collection Management](#27-season--collection-management) | New Feature | Medium | Medium | Done |
| 28 | [Customer Communication Hub](#28-customer-communication-hub) | New Feature | Medium | Complex | Done |
| 29 | [Custom Role & Permission Builder](#29-custom-role--permission-builder) | Enhancement | Medium | Medium | Done |
| 30 | [Product Recommendations & Cross-Selling](#30-product-recommendations--cross-selling) | New Feature | Medium | Medium | Done |
| 31 | [Dashboard Customization (Widget Builder)](#31-dashboard-customization-widget-builder) | Enhancement | Medium | Complex | Done |
| 32 | [Automated Demand Forecasting](#32-automated-demand-forecasting) | New Feature | Medium | Complex | Done |
| 33 | [Webhook & Integration API](#33-webhook--integration-api) | New Feature | Medium | Medium | Done |
| 34 | [Warranty & After-Sales Service Tracking](#34-warranty--after-sales-service-tracking) | New Feature | Medium | Medium | Done |
| 35 | [Multi-Currency Support](#35-multi-currency-support) | Enhancement | Medium | Medium | Done |
| 36 | [Customer Feedback & NPS Collection](#36-customer-feedback--nps-collection) | New Feature | Medium | Simple | Done |
| 37 | [Scheduled Reports & Email Digests](#37-scheduled-reports--email-digests) | Enhancement | Medium | Simple | Done |
| 38 | [Store Credit Unified Wallet](#38-store-credit-unified-wallet) | Enhancement | Medium | Medium | Done |
| 39 | [Product Lookbook / Visual Catalog](#39-product-lookbook--visual-catalog) | New Feature | Medium | Medium | Done |
| 40 | [Backup & Restore with Cloud Sync](#40-backup--restore-with-cloud-sync) | New Feature | Medium | Medium | Done |
| 41 | [Advanced Barcode Label Designer (WYSIWYG)](#41-advanced-barcode-label-designer-wysiwyg) | Enhancement | Low | Complex | Done |
| 42 | [Customer Self-Service Kiosk Mode](#42-customer-self-service-kiosk-mode) | New Feature | Low | Complex | Done |
| 43 | [Supplier Payments & Accounts Payable](#43-supplier-payments--accounts-payable) | New Feature | Low | Complex | Done |
| 44 | [Staff Commission Tracking](#44-staff-commission-tracking) | New Feature | Low | Medium | Done |
| 45 | [Activity Feed & Collaboration Notes](#45-activity-feed--collaboration-notes) | Enhancement | Low | Simple | Done |

### Wave 3 (Completed)

| # | Title | Type | Priority | Complexity | Status |
|---|-------|------|----------|------------|--------|
| 46 | [Multi-Store / Branch Management](#46-multi-store--branch-management) | New Feature | High | Complex | Done |
| 47 | [Store Performance & Consolidated Dashboard](#47-store-performance--consolidated-dashboard) | New Feature | High | Medium | Done |
| 48 | [Inter-Store Stock Transfers](#48-inter-store-stock-transfers) | New Feature | High | Medium | Done |
| 49 | [E-commerce Customer Accounts](#49-e-commerce-customer-accounts) | New Feature | High | Complex | Done |
| 50 | [Online Orders & Storefront](#50-online-orders--storefront) | New Feature | High | Complex | Done |
| 51 | [Product Reviews & Q&A](#51-product-reviews--qa) | New Feature | Medium | Simple | Done |
| 52 | [Storefront Configuration](#52-storefront-configuration) | New Feature | Medium | Medium | Done |
| 53 | [Custom Report Builder](#53-custom-report-builder) | New Feature | High | Complex | Done |
| 54 | [Data Warehouse & Materialized Views](#54-data-warehouse--materialized-views) | New Feature | Medium | Medium | Done |
| 55 | [Dashboard Widgets (Extended)](#55-dashboard-widgets-extended) | Enhancement | Medium | Simple | Done |
| 56 | [Marketplace Vendor Management](#56-marketplace-vendor-management) | New Feature | High | Complex | Done |
| 57 | [Vendor Products & Approvals](#57-vendor-products--approvals) | New Feature | High | Medium | Done |
| 58 | [Vendor Commissions & Payouts](#58-vendor-commissions--payouts) | New Feature | High | Medium | Done |
| 59 | [Vendor Reviews & Metrics](#59-vendor-reviews--metrics) | New Feature | Medium | Simple | Done |
| 60 | [Smart Pricing Engine](#60-smart-pricing-engine) | New Feature | High | Complex | Done |
| 61 | [AI Chatbot for Support](#61-ai-chatbot-for-support) | New Feature | Medium | Complex | Done |
| 62 | [Sales Predictions & Trend Analysis](#62-sales-predictions--trend-analysis) | New Feature | Medium | Medium | Done |
| 63 | [Automated Product Descriptions](#63-automated-product-descriptions) | New Feature | Medium | Medium | Done |

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

## Wave 1 — Implementation Status

All 20 features from Wave 1 have been implemented. The system now includes:

- **Core POS**: Refunds, receipts, held carts, keyboard shortcuts, tax/VAT
- **Inventory**: Cost tracking, profit margins, stock adjustments, bulk operations, product images, variants
- **Analytics**: Cashier performance, category/distributor sales, PDF/CSV export
- **Customers**: Purchase history, loyalty points system
- **Operations**: Delivery tracking with shipping companies, purchase orders, audit log, notifications

*Wave 1 completed as of Feb 2026.*

---

# Wave 2 — Next-Generation Features

> Generated from a comprehensive audit of all 20 pages, 37 migrations, 22 route files, 5 stores, and 40+ components (Feb 2026).

---

## 21. Cash Register / Drawer Management

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
There is no concept of cash float, drawer opening/closing, or end-of-day cash reconciliation. Cashiers handle cash payments but there's no accountability for what's in the register. Admins cannot verify that cash in hand matches what the system says. This is a fundamental gap for any physical retail POS.

### Proposed solution
Introduce a cash register session model. Cashier opens a shift with a starting float, processes sales, and closes the shift with a counted amount. The system compares expected vs. actual cash, flagging discrepancies. Generate X-reports (mid-shift) and Z-reports (end-of-day).

### Key functionality / acceptance criteria
- [ ] "Open Register" flow: enter starting cash float before processing sales
- [ ] Cash sales automatically added to drawer running total
- [ ] Cash refunds deducted from drawer total
- [ ] "Cash In/Out" for non-sale movements (e.g., petty cash withdrawal, tips deposit)
- [ ] "Close Register" flow: enter counted amounts by denomination, system calculates expected vs. actual
- [ ] X-Report: mid-shift summary (doesn't close session)
- [ ] Z-Report: end-of-day summary (closes session, printable)
- [ ] Variance tracking: over/short with threshold alerts
- [ ] Register session history with filters (cashier, date, variance)
- [ ] Force-close by admin if cashier forgets

### UI/UX considerations
- POS page blocked until register is opened (modal on entry)
- Running cash total shown as a subtle indicator in POS header
- Close register: denomination counter with calculator-style input
- Z-Report styled as a printable document matching receipt branding

### Technical notes
- **New DB tables:** `register_sessions` (id, cashier_id, opened_at, closed_at, opening_float, expected_cash, counted_cash, variance, status), `register_movements` (id, session_id, type [sale/refund/cash_in/cash_out], amount, note, created_at)
- **New migration:** `038_register_sessions.sql`
- **New endpoints:** `POST /api/register/open`, `POST /api/register/movement`, `POST /api/register/close`, `GET /api/register/current`, `GET /api/register/history`, `GET /api/register/:id/report`
- **Modified:** `POST /api/sales` — link to active register session
- **New page section or modal** in POS
- **i18n:** ~20 new keys

---

## 22. Exchange Workflow

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
Refunds exist but exchanges don't. If a customer wants to swap a size M shirt for a size L, the cashier must process a full refund and then a separate new sale. This creates two transactions, distorts sales counts, and is slow at the register. Fashion retail has a very high exchange rate.

### Proposed solution
Add an "Exchange" flow where the cashier selects items being returned, selects replacement items, and the system calculates the price difference. If the new items cost more, customer pays the difference. If less, a partial refund is issued.

### Key functionality / acceptance criteria
- [ ] "Exchange" button alongside "Refund" in Sales History
- [ ] Step 1: Select items being returned (with quantities)
- [ ] Step 2: Add replacement items to an exchange cart
- [ ] Step 3: System shows return credit, new items total, and balance (pay or refund)
- [ ] Balance > 0: customer pays difference (any payment method)
- [ ] Balance < 0: refund the difference
- [ ] Stock adjusted both ways (returned items restocked, new items deducted)
- [ ] Exchange linked to original sale for traceability
- [ ] Exchange receipt shows both returned and new items
- [ ] Sales analytics treat exchanges separately from refunds

### UI/UX considerations
- Two-panel layout: "Returning" on left, "New Items" on right
- Balance shown prominently in the center (green = customer pays, red = store refunds)
- Quick variant swap: if returning a variant, suggest other variants of same product

### Technical notes
- **New DB table:** `exchanges` (id, original_sale_id, new_sale_id, return_amount, new_amount, balance, created_at)
- **New endpoints:** `POST /api/sales/:id/exchange`
- **Modified:** Stock adjustment logging for both sides
- **New component:** `ExchangeDialog.tsx`
- **i18n:** ~12 new keys

---

## 23. Employee Shift & Time Tracking

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
There is no concept of work shifts. Admins cannot see who is working, when they started, how many hours they logged, or correlate staffing with revenue. Cashier performance analytics exist but without time context — a cashier who works 8 hours will always outsell one who works 4 hours.

### Proposed solution
Add clock-in/clock-out for all staff. Track work hours, breaks, and overtime. Normalize cashier performance by hours worked (revenue per hour, sales per hour).

### Key functionality / acceptance criteria
- [ ] Clock-in on login or via explicit button
- [ ] Clock-out on logout or via button
- [ ] Break tracking (start/end break)
- [ ] Shift summary: hours worked, break duration, sales processed (for cashiers)
- [ ] Admin view: who is currently clocked in, today's schedule
- [ ] Weekly timesheet report per employee
- [ ] Overtime calculation (configurable threshold, e.g., 8h/day)
- [ ] Cashier performance normalized: revenue/hour, sales/hour
- [ ] Export timesheets as CSV

### UI/UX considerations
- Clock-in/out button in sidebar footer (next to user info)
- "Active Now" indicators in Users page
- Green dot = clocked in, grey = off duty
- Timesheet as a calendar grid view

### Technical notes
- **New DB table:** `shifts` (id, user_id, clock_in, clock_out, break_start, break_end, total_hours, overtime_hours)
- **New migration:** `039_shifts.sql`
- **New endpoints:** `POST /api/shifts/clock-in`, `POST /api/shifts/clock-out`, `POST /api/shifts/break`, `GET /api/shifts/active`, `GET /api/shifts/history`
- **Modified:** Analytics cashier performance — include hours worked
- **i18n:** ~15 new keys

---

## 24. Expense Tracking & P&L Statement

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
The system tracks revenue and gross profit (cost of goods sold) but has **zero visibility into operating expenses** — rent, salaries, utilities, marketing, maintenance. The admin sees gross profit but cannot determine true net profitability. Every business needs this.

### Proposed solution
Add an expense tracking module with recurring and one-time expenses. Generate a monthly P&L statement combining revenue, COGS, and expenses.

### Key functionality / acceptance criteria
- [ ] Expense categories: Rent, Salaries, Utilities, Marketing, Supplies, Other (customizable)
- [ ] Create one-time or recurring expenses (daily/weekly/monthly/yearly)
- [ ] Attach receipt photo/document to expense
- [ ] Monthly expense summary by category
- [ ] P&L Statement: Revenue - COGS - Expenses = Net Profit
- [ ] P&L comparison: this month vs. last month, this year vs. last year
- [ ] Dashboard KPI: "Net Profit" card alongside existing gross profit
- [ ] Export P&L as PDF

### UI/UX considerations
- New "Expenses" page with category breakdown chart
- P&L as a clean financial statement layout (accountant-friendly)
- Recurring expense indicator (repeat icon + frequency)
- Color-coded categories in expense table

### Technical notes
- **New DB tables:** `expense_categories`, `expenses` (id, category_id, amount, description, date, is_recurring, recurrence, receipt_url, created_at)
- **New routes:** `/api/expenses`, `/api/analytics/pnl`
- **New page:** `Expenses.tsx`
- **Modified Dashboard:** add net profit KPI
- **i18n:** ~20 new keys

---

## 25. Customer Segmentation & RFM Analysis

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
Customers have loyalty points but there's no intelligent segmentation. The system can't answer: "Who are my VIP customers?", "Who hasn't bought in 3 months?", "Who spends the most but visits infrequently?". Without segmentation, marketing is spray-and-pray.

### Proposed solution
Implement automated RFM (Recency, Frequency, Monetary) analysis. Automatically classify customers into segments: Champions, Loyal, At Risk, Lost, New, etc. Show segment-specific KPIs and action recommendations.

### Key functionality / acceptance criteria
- [ ] Auto-calculated RFM scores per customer (1-5 scale each)
- [ ] Customer segments: Champions (high R+F+M), Loyal, Potential Loyalists, At Risk, Hibernating, Lost, New Customers
- [ ] Segment dashboard: count per segment, revenue per segment, pie chart
- [ ] Customer list filterable by segment
- [ ] Segment detail: list of customers with RFM scores and last purchase date
- [ ] "At Risk" and "Lost" alerts in notification center
- [ ] Configurable RFM thresholds in settings
- [ ] Manual segment override (admin can reclassify a customer)

### UI/UX considerations
- RFM matrix visualization (optional: 2D scatter plot)
- Segment cards with customer avatars and key stats
- Color-coded segments (green=Champions, red=Lost, yellow=At Risk)
- "Win-Back" action button on At Risk / Lost segments

### Technical notes
- **Computed columns or scheduled job:** calculate RFM from sales + customer data
- **New endpoint:** `GET /api/analytics/customer-segments`, `GET /api/customers/segments`
- **Modified:** Customer list — add segment badge
- **New chart:** `CustomerSegmentChart.tsx`
- **i18n:** ~15 new keys

---

## 26. Layaway / Credit Sale / Pay Later

**Type:** New Feature
**Priority:** High
**Complexity:** Complex

### Problem it solves
All sales require full payment at checkout. In fashion retail, layaway (reserve item, pay over time) and store credit accounts are common. High-value items like luxury coats or suits often need installment options. Split payments exist but only for the current transaction.

### Proposed solution
Add a layaway/credit system. Customers can reserve items with a partial payment and complete payment over time. Track outstanding balances per customer. Items stay reserved until fully paid or the layaway expires.

### Key functionality / acceptance criteria
- [ ] "Layaway" payment option at checkout (partial payment accepted)
- [ ] Minimum deposit configurable (e.g., 25% of total)
- [ ] Layaway order created with payment schedule
- [ ] Customer can make additional payments toward the balance
- [ ] Items reserved (stock deducted) but not released until fully paid
- [ ] Layaway expiry: configurable (e.g., 30 days) — items released if not paid
- [ ] Customer profile shows outstanding layaway balances
- [ ] Layaway list page for admin with status filters
- [ ] Overdue layaway alerts
- [ ] Complete layaway: release items to customer on full payment

### UI/UX considerations
- Layaway option in checkout sheet alongside Cash/Card
- Deposit amount slider or input
- "Outstanding Balance" badge on customer profile
- Payment timeline showing paid vs. remaining

### Technical notes
- **New DB tables:** `layaways` (id, sale_id, customer_id, total, paid, balance, due_date, status), `layaway_payments` (id, layaway_id, amount, method, created_at)
- **New routes:** `/api/layaways`
- **New page or tab:** Layaways section in Sales or standalone
- **Modified:** CartPanel checkout — layaway option
- **i18n:** ~18 new keys

---

## 27. Season / Collection Management

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
This is a **fashion** retail system but there is no concept of seasons or collections — a core concept in fashion. Products can't be tagged as "Spring 2026" or "Winter Collection". There's no way to analyze performance by collection, plan seasonal markdowns, or manage collection lifecycles.

### Proposed solution
Add seasons/collections as a product grouping dimension. Products can belong to one or more collections. Analytics by collection. Seasonal markdown scheduling.

### Key functionality / acceptance criteria
- [ ] Create collections: name, season (Spring/Summer/Fall/Winter), year, status (Upcoming/Active/On Sale/Archived)
- [ ] Assign products to collections (many-to-many)
- [ ] Collection dashboard: revenue, units sold, remaining stock, margin
- [ ] Seasonal markdown: schedule price reductions for end-of-season
- [ ] Bulk "archive collection" moves all products to discontinued
- [ ] Collection filter in POS and Inventory
- [ ] Analytics: "Revenue by Collection" chart on dashboard

### UI/UX considerations
- New "Collections" nav item with seasonal color coding
- Timeline view showing collection lifecycle
- Visual collection cards with hero image
- Markdown scheduling as a date picker + percentage

### Technical notes
- **New DB tables:** `collections` (id, name, season, year, status, starts_at, ends_at), `product_collections` (product_id, collection_id)
- **New routes:** `/api/collections`
- **New page:** `Collections.tsx`
- **Modified:** Product form — collection assignment
- **i18n:** ~15 new keys

---

## 28. Customer Communication Hub

**Type:** New Feature
**Priority:** Medium
**Complexity:** Complex

### Problem it solves
Twilio is integrated for delivery notifications only. There's no way to communicate with customers for marketing: new arrivals, sales events, birthday promotions, loyalty milestones. Customer data is collected but never leveraged for engagement.

### Proposed solution
Build a communication hub for sending targeted messages to customer segments. Support SMS (Twilio already integrated) and email. Templates, scheduling, and campaign tracking.

### Key functionality / acceptance criteria
- [ ] Message templates: create reusable templates with `{customer_name}`, `{points_balance}` placeholders
- [ ] Send to: all customers, specific segment, manual selection
- [ ] Channels: SMS (Twilio), Email (configurable SMTP or SendGrid)
- [ ] Campaign scheduling: send now or schedule for later
- [ ] Campaign tracking: sent, delivered, failed counts
- [ ] Auto-triggers: welcome message, birthday, loyalty tier upgrade, win-back (no purchase in X days)
- [ ] Opt-out tracking: customers can unsubscribe
- [ ] Campaign history log

### UI/UX considerations
- "Campaigns" page with template builder
- Audience selector with segment integration (from feature #25)
- Preview before send
- Campaign analytics: delivery rates

### Technical notes
- **New DB tables:** `campaigns`, `campaign_messages`, `message_templates`, `customer_preferences` (opt-in/out)
- **New routes:** `/api/campaigns`, `/api/templates`
- **New service:** `emailService.ts` (SMTP/SendGrid)
- **Modified:** Twilio service — extend for marketing SMS
- **i18n:** ~20 new keys

---

## 29. Custom Role & Permission Builder

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
Only 3 hardcoded roles exist: Admin, Cashier, Delivery. Real businesses need more nuance: a "Manager" who can see analytics but not delete products, an "Inventory Clerk" who manages stock but not sales, a "Cashier Lead" who can process refunds. Currently it's all-or-nothing.

### Proposed solution
Replace hardcoded roles with a permission-based system. Admin creates custom roles and assigns granular permissions. Existing roles become templates.

### Key functionality / acceptance criteria
- [ ] Permission matrix: module (POS, Inventory, Sales, Delivery, Analytics, Users, Settings) x action (view, create, edit, delete)
- [ ] Special permissions: process refunds, manage discounts, view cost prices, export data
- [ ] Create custom roles (e.g., "Store Manager", "Inventory Clerk", "Senior Cashier")
- [ ] Default roles preserved as templates (Admin=all, Cashier=POS+Inventory+Sales, Delivery=Deliveries)
- [ ] Permission check on every route and every UI element
- [ ] Role assignment in User create/edit form
- [ ] "Permissions" tab in Settings

### UI/UX considerations
- Checkbox grid: roles on columns, permissions on rows
- Quick templates: "Start from Admin", "Start from Cashier"
- UI elements hidden/disabled based on permissions (not just routes)

### Technical notes
- **New DB tables:** `roles` (id, name, permissions JSON), refactor `users.role` to `users.role_id FK`
- **Modified:** `auth.ts` middleware — check permissions instead of role strings
- **Modified:** Every `requireRole()` call to `requirePermission()`
- **Modified:** Sidebar — filter by permissions
- **i18n:** ~15 new keys

---

## 30. Product Recommendations & Cross-Selling

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
When a cashier adds an item to the cart, there are no suggestions for complementary items. "Customers who bought this blazer also bought these trousers." Fashion retail thrives on outfit completion and upselling. Average order value could increase significantly.

### Proposed solution
Analyze historical sales data to find products frequently bought together. Show suggestions in the POS cart panel. Allow manual "recommended pairings" by admin.

### Key functionality / acceptance criteria
- [ ] Algorithm: "Frequently Bought Together" based on sale_items co-occurrence
- [ ] Show 2-3 recommendations when an item is added to cart
- [ ] One-click "Add to Cart" from recommendation
- [ ] Admin: manually pair products (e.g., "This belt goes with these shoes")
- [ ] "Complete the Look" section in cart panel
- [ ] Recommendation effectiveness tracking (shown vs. added)
- [ ] Refresh recommendations nightly via scheduled calculation

### UI/UX considerations
- Subtle suggestion strip below cart items: "Complete the Look"
- Product thumbnails with price and quick-add button
- Don't show if cart has 5+ items (too cluttered)
- Dismissible per session

### Technical notes
- **New DB table:** `product_associations` (product_a_id, product_b_id, score, type [auto/manual])
- **New endpoint:** `GET /api/products/:id/recommendations`
- **Scheduled job or on-demand:** `POST /api/analytics/calculate-associations`
- **Modified:** `CartPanel.tsx` — recommendations section
- **i18n:** ~6 new keys

---

## 31. Dashboard Customization (Widget Builder)

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Complex

### Problem it solves
The dashboard has a fixed layout with predefined charts. Every admin sees the same data. Some want revenue front-and-center, others care about inventory. There's no way to add custom metrics, rearrange widgets, or create role-specific dashboards.

### Proposed solution
Make the dashboard widget-based. Admins can add, remove, resize, and rearrange widgets. Save layout per user. Provide a library of available widgets.

### Key functionality / acceptance criteria
- [ ] Widget library: KPI card, line chart, bar chart, pie chart, table, funnel
- [ ] Data sources: all existing analytics endpoints + custom SQL for admin
- [ ] Drag-and-drop widget arrangement
- [ ] Resize widgets (1x1, 1x2, 2x2 grid)
- [ ] Save layout per user (persisted)
- [ ] Default layouts per role
- [ ] "Reset to Default" option
- [ ] Add custom KPI: name + SQL query (admin only, with safety limits)

### UI/UX considerations
- Edit mode toggle: "Customize Dashboard" button
- In edit mode: drag handles, resize handles, delete buttons
- Widget picker: drawer with preview of each widget type
- Smooth animations for drag-and-drop

### Technical notes
- **New DB table:** `dashboard_layouts` (id, user_id, layout JSON)
- **Package:** `react-grid-layout` for drag-and-drop grid
- **Major refactor:** Dashboard.tsx into widget-based architecture
- **New endpoint:** `GET/PUT /api/users/me/dashboard-layout`
- **i18n:** ~10 new keys

---

## 32. Automated Demand Forecasting

**Type:** New Feature
**Priority:** Medium
**Complexity:** Complex

### Problem it solves
Reorder points and ABC classification exist but they're static. The system doesn't predict future demand. An item that sells 50/week in summer and 5/week in winter has the same reorder point year-round. This leads to overstock in off-season and stockouts in peak season.

### Proposed solution
Implement simple demand forecasting using moving averages and seasonal decomposition. Predict next 30/60/90 day demand per product. Auto-suggest reorder quantities and timing.

### Key functionality / acceptance criteria
- [ ] Daily sales velocity calculation per product (7-day, 30-day, 90-day moving averages)
- [ ] Seasonal index: detect weekly and monthly patterns from 3+ months of data
- [ ] Forecast next 30/60/90 days of demand per product
- [ ] "Days of Stock Remaining" calculation per product
- [ ] Auto-suggest reorder: "Product X will run out in 12 days, suggest PO for 50 units"
- [ ] Forecast accuracy tracking (predicted vs. actual)
- [ ] Forecast visualization: trend line with confidence interval
- [ ] Integration with Purchase Orders: pre-fill PO from forecast

### UI/UX considerations
- Forecast chart per product (in product detail)
- "Reorder Suggestions" widget on dashboard
- "Days of Stock" column in inventory table (color-coded)
- Confidence indicator: high/medium/low based on data quality

### Technical notes
- **Server-side computation:** daily cron or on-demand calculation
- **New DB table:** `demand_forecasts` (product_id, date, predicted_qty, actual_qty, method)
- **New endpoints:** `GET /api/analytics/forecast/:productId`, `POST /api/analytics/forecast/run`, `GET /api/analytics/reorder-suggestions`
- **Algorithm:** weighted moving average + seasonal decomposition (pure JS, no ML library needed)
- **i18n:** ~12 new keys

---

## 33. Webhook & Integration API

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
The system is completely closed. There's no way to integrate with external services — accounting software (QuickBooks, Xero), e-commerce platforms (Shopify, WooCommerce), marketing tools (Mailchimp), or custom workflows. Every business eventually needs integrations.

### Proposed solution
Add a webhook system that fires events to external URLs on key actions. Also add API key authentication for a public REST API subset.

### Key functionality / acceptance criteria
- [ ] Webhook events: sale.created, sale.refunded, product.low_stock, product.created, product.updated, delivery.status_changed, customer.created
- [ ] Webhook management in Settings: add URL, select events, test webhook
- [ ] Retry logic: 3 retries with exponential backoff
- [ ] Webhook log: delivery history (success/fail, response code, payload)
- [ ] API keys: generate API keys for external access (Admin)
- [ ] Rate limiting per API key
- [ ] API key permissions: read-only or read-write per module

### UI/UX considerations
- "Integrations" tab in Settings
- Webhook list with status indicators (green=active, red=failing)
- "Test" button sends a sample payload
- API key management with copy-to-clipboard and regenerate

### Technical notes
- **New DB tables:** `webhooks` (id, url, events JSON, secret, status), `webhook_logs`, `api_keys` (id, key_hash, permissions, user_id)
- **New middleware:** API key auth (alternative to JWT for external access)
- **Event emitter:** Hook into existing routes to fire webhook events
- **Background worker:** Async webhook delivery with retry queue
- **i18n:** ~15 new keys

---

## 34. Warranty & After-Sales Service Tracking

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
There is no warranty or after-sales service concept. If a customer returns with a defective product 2 weeks after purchase, there's no way to check warranty status, log a service request, or track repair/replacement progress. Fashion items like leather goods and luxury accessories often carry warranties.

### Proposed solution
Add configurable warranty periods per product/category. Track warranty claims with status workflow. Link claims to original sales.

### Key functionality / acceptance criteria
- [ ] Warranty period per product or category (in days, default: 0 = no warranty)
- [ ] Warranty check: input sale ID or scan receipt barcode to see warranty status (valid/expired)
- [ ] Create warranty claim: product, issue description, photos, requested action (repair/replace/refund)
- [ ] Claim workflow: Submitted, Under Review, Approved, In Progress, Resolved, Rejected
- [ ] Link claim to original sale (auto-lookup)
- [ ] Customer notification on status change (via existing notification system)
- [ ] Warranty claims report: count by status, avg resolution time, common issues

### UI/UX considerations
- "Warranty Claims" section accessible from Sales History or new nav item
- Warranty status indicator in sale detail: green check or expired badge
- Claim form with photo upload
- Status timeline similar to delivery tracking

### Technical notes
- **New DB tables:** `warranty_claims` (id, sale_id, sale_item_id, customer_id, issue, photos JSON, status, resolution, created_at, resolved_at)
- **ALTER:** products + categories — add `warranty_days INTEGER DEFAULT 0`
- **New routes:** `/api/warranty`
- **New page or section:** `WarrantyClaims.tsx`
- **i18n:** ~15 new keys

---

## 35. Multi-Currency Support

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
The system assumes a single currency. For stores near borders, tourist areas, or with international customers, accepting multiple currencies is essential. Prices are stored without a currency indicator.

### Proposed solution
Add a base currency setting and support for secondary currencies with configurable exchange rates. POS can accept payment in any configured currency.

### Key functionality / acceptance criteria
- [ ] Base currency setting (e.g., SAR, USD, EUR)
- [ ] Configure additional currencies with exchange rates
- [ ] Manual or API-fetched exchange rates (daily update)
- [ ] POS: select payment currency at checkout
- [ ] Receipt shows payment currency + converted amount in base currency
- [ ] All reports/analytics remain in base currency
- [ ] Price display toggle: show prices in selected currency

### UI/UX considerations
- Currency selector in checkout sheet
- Exchange rate table in Settings
- "Last updated" indicator for exchange rates
- Currency symbol throughout UI adapts to locale

### Technical notes
- **New DB table:** `currencies` (code, name, symbol, exchange_rate, is_base, updated_at)
- **Modified:** `sale_payments` — add currency_code, exchange_rate_at_time
- **New Setting:** base currency configuration
- **Modified:** `formatCurrency()` utility — support multiple currencies
- **i18n:** ~10 new keys

---

## 36. Customer Feedback & NPS Collection

**Type:** New Feature
**Priority:** Medium
**Complexity:** Simple

### Problem it solves
There's no feedback loop from customers. The business can't measure satisfaction, identify service issues, or track Net Promoter Score. Customer display exists but is passive — it could prompt for feedback after a transaction.

### Proposed solution
After a sale is completed, prompt for a quick rating on the customer display. Collect NPS score and optional comment. Track satisfaction trends over time.

### Key functionality / acceptance criteria
- [ ] Customer display shows feedback prompt after sale: "How was your experience?" with 1-5 star rating
- [ ] Optional one-tap comment: "Great service", "Long wait", "Item not available", custom text
- [ ] NPS question (0-10 scale): "How likely are you to recommend us?"
- [ ] Feedback linked to sale and customer (if identified)
- [ ] Feedback dashboard: average rating trend, NPS score, common comments (word cloud)
- [ ] Low-rating alert to admin (notification)
- [ ] Auto-dismiss feedback screen after 30 seconds

### UI/UX considerations
- Large, touch-friendly star rating on customer display
- Quick-tap comment buttons (no typing needed)
- Thank you animation after submission
- Dashboard: NPS gauge chart (detractors/passives/promoters)

### Technical notes
- **New DB table:** `feedback` (id, sale_id, customer_id, rating, nps_score, comments, created_at)
- **New endpoints:** `POST /api/feedback`, `GET /api/analytics/feedback`
- **Modified:** `CustomerDisplay.tsx` — feedback mode after sale
- **New chart:** `FeedbackChart.tsx`
- **i18n:** ~10 new keys

---

## 37. Scheduled Reports & Email Digests

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Simple

### Problem it solves
Analytics export exists but is manual. Admins must log in and click "Export" to get reports. There are no automated daily/weekly/monthly reports delivered to email. Business owners want a morning email with yesterday's summary without opening the app.

### Proposed solution
Schedule recurring reports that are generated and emailed automatically. Daily sales summary, weekly P&L, monthly inventory valuation, etc.

### Key functionality / acceptance criteria
- [ ] Report templates: Daily Sales Summary, Weekly Revenue, Monthly P&L, Inventory Valuation, Low Stock Alert
- [ ] Schedule: daily, weekly (choose day), monthly (choose date)
- [ ] Delivery: email (configurable recipients)
- [ ] Report format: PDF attachment + summary in email body
- [ ] Enable/disable individual scheduled reports
- [ ] Manual trigger: "Send Now" for any scheduled report
- [ ] Delivery log: sent, failed, timestamps

### UI/UX considerations
- "Scheduled Reports" tab in Exports page
- Toggle switches for each report with schedule selector
- Recipient list with add/remove
- Preview button to see report before scheduling

### Technical notes
- **New DB table:** `scheduled_reports` (id, type, schedule, recipients JSON, last_sent, status)
- **Server cron:** `node-cron` or `node-schedule` for timing
- **Reuse:** existing export utilities + email service (from feature #28 or new)
- **New endpoints:** `/api/reports/schedules` CRUD
- **i18n:** ~10 new keys

---

## 38. Store Credit Unified Wallet

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
Gift cards, loyalty points, and potential refund credits are three separate systems. A customer might have a gift card balance, loyalty points, and a store credit from a refund — but these can't be viewed or used together. Fashion retail benefits from a unified customer wallet.

### Proposed solution
Create a unified customer wallet that combines all credit sources. Single balance view, single redemption flow at checkout, with clear breakdown of sources.

### Key functionality / acceptance criteria
- [ ] Customer wallet: single balance view combining gift card balance, loyalty points (converted to currency), and refund credits
- [ ] Wallet breakdown: "Gift Card: $50, Loyalty: $15, Refund Credit: $20 = Total: $85"
- [ ] At checkout: "Pay with Wallet" uses combined balance
- [ ] Wallet top-up: admin can add credit manually with reason
- [ ] Wallet transaction history: all credit/debit events in one timeline
- [ ] Auto-conversion: loyalty points to wallet currency at redemption rate
- [ ] Wallet shown on customer detail page

### UI/UX considerations
- Wallet balance badge on customer name in CartPanel
- "Pay with Wallet" as a payment method at checkout
- Wallet section in customer detail with visual breakdown (stacked bar)
- Transaction timeline with icons per source type

### Technical notes
- **New DB table:** `wallet_transactions` (id, customer_id, source_type [gift_card/loyalty/refund/manual], source_id, amount, balance_after, created_at)
- **Modified:** Checkout flow — wallet payment method
- **Modified:** Customer detail — wallet section
- **New endpoint:** `GET /api/customers/:id/wallet`, `POST /api/customers/:id/wallet/topup`
- **i18n:** ~10 new keys

---

## 39. Product Lookbook / Visual Catalog

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
Product images exist but there's no visual catalog or lookbook feature. Fashion retail is inherently visual. Staff can't show customers styled outfits, new arrivals in a curated layout, or "shop the look" presentations. The customer display is basic.

### Proposed solution
Create a visual lookbook/catalog mode. Admin curates "looks" (styled outfits combining multiple products). Display on customer-facing screen or tablet. Staff can browse and share with customers during consultation.

### Key functionality / acceptance criteria
- [ ] Create "Look": name, description, hero image, tagged products
- [ ] Products in a look are displayed with their images and prices
- [ ] "Shop this Look" adds all items to cart in one click
- [ ] Lookbook carousel on customer display
- [ ] Digital catalog mode: full-screen browsing of all products by category with large images
- [ ] Sort by new arrivals, best sellers, on sale
- [ ] QR code generation per look for social media sharing

### UI/UX considerations
- Pinterest-style masonry grid for lookbook
- Large product images with minimal text
- Elegant transition animations
- Fullscreen mode for customer display / in-store tablet

### Technical notes
- **New DB table:** `lookbooks` (id, name, description, hero_image, status), `lookbook_items` (id, lookbook_id, product_id, sort_order)
- **New routes:** `/api/lookbooks`
- **New page:** `Lookbook.tsx` (admin), enhanced `CustomerDisplay.tsx`
- **i18n:** ~10 new keys

---

## 40. Backup & Restore with Cloud Sync

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
The entire business runs on a single SQLite file (`moon.db`). If the disk fails, the machine is stolen, or the file gets corrupted, **all data is lost**. There's no backup mechanism, no cloud sync, and no disaster recovery plan. This is a critical business continuity risk.

### Proposed solution
Add automated local + cloud backup. Schedule daily backups. One-click restore. Optional cloud sync to Google Drive or S3.

### Key functionality / acceptance criteria
- [ ] Manual backup: "Backup Now" button in Settings creates timestamped `.db` copy
- [ ] Automated backup: configurable schedule (daily, every 12h, etc.)
- [ ] Backup retention: keep last N backups (configurable, default 30)
- [ ] Restore from backup: select backup file, confirm, restart server
- [ ] Cloud upload: optional push to S3/GCS/local NAS
- [ ] Backup log: timestamp, size, location, status
- [ ] Integrity check: verify backup by opening and running a test query
- [ ] Export full data as JSON (for migration purposes)

### UI/UX considerations
- "Backup & Restore" card in Settings
- Backup list with size, date, and download/restore/delete actions
- Warning modal for restore: "This will replace all current data"
- Cloud sync status indicator

### Technical notes
- **Server utility:** Copy `moon.db` + WAL files atomically
- **New endpoints:** `POST /api/backup`, `GET /api/backups`, `POST /api/restore`, `DELETE /api/backups/:id`
- **Cron job:** Scheduled backup using `node-cron`
- **Optional:** AWS S3 SDK or Google Cloud Storage for cloud
- **Modified Settings page:** backup section
- **i18n:** ~12 new keys

---

## 41. Advanced Barcode Label Designer (WYSIWYG)

**Type:** Enhancement
**Priority:** Low
**Complexity:** Complex

### Problem it solves
Label templates exist in the database as JSON but the editing experience is basic. Designing custom price tags, shelf labels, and product stickers requires trial-and-error JSON editing. Fashion retail needs branded, attractive labels.

### Proposed solution
Build a visual drag-and-drop label designer. Place barcode, product name, price, logo, and custom text on a canvas. WYSIWYG preview at actual print size.

### Key functionality / acceptance criteria
- [ ] Canvas with exact dimensions (e.g., 50x30mm)
- [ ] Draggable elements: barcode, QR code, text, image, line, rectangle
- [ ] Element properties: font, size, bold/italic, alignment, position (x/y/w/h)
- [ ] Data binding: elements bound to product fields (name, price, SKU, barcode)
- [ ] Live preview with sample product data
- [ ] Save as named template
- [ ] Print preview: show grid of labels as they'll appear on label sheet
- [ ] Import/export template as JSON

### UI/UX considerations
- Canvas with grid lines and snap-to-grid
- Property panel on the side
- Zoom in/out for precision
- "Print Preview" button showing full label sheet

### Technical notes
- **Package:** `fabric.js` or `konva` for canvas manipulation
- **Major enhancement** to BarcodeTools page
- **Modified:** `labelTemplates` routes — already have CRUD
- **New component:** `LabelDesigner.tsx`
- **i18n:** ~10 new keys

---

## 42. Customer Self-Service Kiosk Mode

**Type:** New Feature
**Priority:** Low
**Complexity:** Complex

### Problem it solves
The customer display is passive — it just shows the current cart. In modern fashion retail, self-service kiosks let customers browse products, check prices, scan barcodes for info, and even start a checkout. This reduces cashier load and improves the shopping experience.

### Proposed solution
Extend the customer display into a full self-service kiosk. Customers can browse the catalog, scan barcodes, check stock, view their loyalty balance, and request assistance.

### Key functionality / acceptance criteria
- [ ] Product catalog browsing by category (touch-optimized)
- [ ] Barcode scanner: scan any product to see price, stock, description, image
- [ ] "Check my points": enter phone/email to see loyalty balance and tier
- [ ] "Call for Assistance" button sends notification to staff
- [ ] Product detail page with multiple images and description
- [ ] Optional: self-checkout with payment terminal integration
- [ ] Kiosk mode locks the browser (no navigation outside the app)
- [ ] Idle timeout returns to home screen

### UI/UX considerations
- Large touch targets (minimum 48x48px)
- High-contrast, clean layout
- Auto-return to home after 60s inactivity
- Language toggle prominent (AR/EN)
- No keyboard needed — on-screen keyboard for search

### Technical notes
- **Major enhancement** to `CustomerDisplay.tsx`
- **New mode:** kiosk vs. cart-display
- **Barcode integration:** camera-based scanning
- **Notification trigger:** WebSocket or polling for staff alerts
- **i18n:** ~15 new keys

---

## 43. Supplier Payments & Accounts Payable

**Type:** New Feature
**Priority:** Low
**Complexity:** Complex

### Problem it solves
Purchase orders track incoming inventory but not payments to suppliers. There's no record of how much is owed to each distributor, when payments are due, or payment history. Accounts payable is completely absent.

### Proposed solution
Add payment tracking to purchase orders and an accounts payable module. Track outstanding balances per distributor, payment terms, and payment history.

### Key functionality / acceptance criteria
- [ ] Payment terms per distributor (Net 30, Net 60, COD, etc.)
- [ ] PO shows payment status: Unpaid, Partially Paid, Paid
- [ ] Record payments against POs (full or partial)
- [ ] Payment methods: Cash, Bank Transfer, Check
- [ ] Accounts payable dashboard: total owed, overdue amount, upcoming due dates
- [ ] Per-distributor ledger: all POs, payments, and balance
- [ ] Payment reminder notifications (X days before due date)
- [ ] Aging report: 0-30, 31-60, 61-90, 90+ days

### UI/UX considerations
- Payment section in PO detail
- "Record Payment" dialog with amount and method
- Accounts payable as a new page or section in Distributors
- Aging chart: stacked bar by distributor

### Technical notes
- **New DB tables:** `supplier_payments` (id, po_id, distributor_id, amount, method, reference, paid_at)
- **ALTER:** distributors — add `payment_terms TEXT DEFAULT 'COD'`
- **ALTER:** purchase_orders — add `payment_status`, `total_paid`, `due_date`
- **New routes:** `/api/supplier-payments`, `/api/analytics/accounts-payable`
- **i18n:** ~15 new keys

---

## 44. Staff Commission Tracking

**Type:** New Feature
**Priority:** Low
**Complexity:** Medium

### Problem it solves
There's no way to track sales commissions for staff. In fashion retail, salespeople often earn a percentage of their sales. Without commission tracking, payroll calculations are manual and incentive structures can't be managed in the system.

### Proposed solution
Add configurable commission rates per role or per user. Auto-calculate commission on each sale. Show earnings dashboard per employee.

### Key functionality / acceptance criteria
- [ ] Commission rate: global default (e.g., 3%) or per-user override
- [ ] Commission calculated on each sale (on total or on profit, configurable)
- [ ] Commission affected by refunds (proportionally reduced)
- [ ] Per-cashier commission report: date range, total sales, total commission
- [ ] Commission dashboard in cashier performance view
- [ ] Monthly commission summary for payroll
- [ ] Export commission report as CSV

### UI/UX considerations
- Commission rate field in User edit form
- Commission column in cashier performance table
- Monthly summary card at top of report
- "My Commission" view for individual cashiers (self-service)

### Technical notes
- **ALTER:** users — add `commission_rate REAL DEFAULT 0`
- **New DB table:** `commissions` (id, sale_id, user_id, sale_amount, commission_amount, created_at)
- **Modified:** `POST /api/sales` — auto-calculate commission
- **New endpoint:** `GET /api/analytics/commissions`
- **i18n:** ~10 new keys

---

## 45. Activity Feed & Collaboration Notes

**Type:** Enhancement
**Priority:** Low
**Complexity:** Simple

### Problem it solves
The audit log tracks actions but it's dry and technical. There's no way for staff to communicate within the system — leave notes for the next shift, flag a product issue, or discuss a customer case. Communication happens outside the system (WhatsApp, paper notes).

### Proposed solution
Add a real-time activity feed (like a team chat/news feed) and contextual notes on entities (products, customers, orders). Staff can post updates, tag colleagues, and pin important messages.

### Key functionality / acceptance criteria
- [ ] Activity feed on dashboard: shows recent actions in human-readable format
- [ ] Post updates: free-text messages visible to all staff or specific roles
- [ ] Pin important messages (stick to top)
- [ ] Contextual notes: attach notes to any product, customer, or order
- [ ] Note history: who wrote what, when
- [ ] "@mention" staff members (triggers notification)
- [ ] Shift handoff note: special note type for shift changes

### UI/UX considerations
- Activity feed as a collapsible panel on dashboard
- Post input at top with role visibility selector
- Notes tab on product/customer/order detail dialogs
- Pinned messages highlighted with accent border

### Technical notes
- **New DB tables:** `activity_posts` (id, user_id, content, pinned, role_visibility, created_at), `entity_notes` (id, entity_type, entity_id, user_id, content, created_at)
- **New endpoints:** `/api/activity`, `/api/notes`
- **New component:** `ActivityFeed.tsx`
- **Modified:** Product, Customer, Order detail views — notes tab
- **i18n:** ~10 new keys

---

## Wave 2 — Recommended Implementation Order

| Phase | Features | Rationale |
|-------|----------|-----------|
| **Phase 1: Operations** | #21 Cash Register, #22 Exchanges, #23 Shifts | Critical daily-operations gaps |
| **Phase 2: Finance** | #24 Expenses & P&L, #26 Layaway | Complete financial picture |
| **Phase 3: Customer Intel** | #25 RFM Segmentation, #36 Feedback & NPS | Unlock customer value from existing data |
| **Phase 4: Fashion** | #27 Collections, #39 Lookbook, #30 Recommendations | Fashion-specific differentiation |
| **Phase 5: Platform** | #29 Custom Roles, #33 Webhooks, #40 Backup | Enterprise readiness |
| **Phase 6: Growth** | #28 Campaigns, #37 Scheduled Reports, #35 Multi-Currency | Scale and reach |
| **Phase 7: Advanced** | #31 Dashboard Builder, #32 Forecasting, #38 Unified Wallet | Intelligence layer |
| **Phase 8: Polish** | #34 Warranty, #41 Label Designer, #42 Kiosk, #43 AP, #44 Commissions, #45 Activity Feed | Finishing touches |

## Wave 2 — Implementation Status

All 25 features from Wave 2 have been implemented. The system now includes:

- **Operations**: Cash register management, exchange workflows, employee shift tracking
- **Finance**: Expense tracking & P&L, layaway/credit sales
- **Customer Intelligence**: RFM segmentation, feedback & NPS collection
- **Fashion**: Season/collection management, product lookbook, recommendations & cross-selling
- **Platform**: Custom roles & permissions, webhook/integration API, backup & restore
- **Growth**: Customer campaigns, scheduled reports, multi-currency support
- **Advanced**: Dashboard builder, demand forecasting, unified wallet
- **Polish**: Warranty tracking, barcode label designer, kiosk mode, supplier payments, staff commissions, activity feed

*Wave 2 completed as of Feb 2026.*

---

# Wave 3 — Enterprise-Grade Features

> 5 major feature areas covering multi-store management, e-commerce, advanced reporting, marketplace, and AI-powered capabilities (Feb 2026).

---

### Wave 3 (Completed)

| # | Title | Type | Priority | Complexity | Status |
|---|-------|------|----------|------------|--------|
| 46 | [Multi-Store / Branch Management](#46-multi-store--branch-management) | New Feature | High | Complex | Done |
| 47 | [Store Performance & Consolidated Dashboard](#47-store-performance--consolidated-dashboard) | New Feature | High | Medium | Done |
| 48 | [Inter-Store Stock Transfers](#48-inter-store-stock-transfers) | New Feature | High | Medium | Done |
| 49 | [E-commerce Customer Accounts](#49-e-commerce-customer-accounts) | New Feature | High | Complex | Done |
| 50 | [Online Orders & Storefront](#50-online-orders--storefront) | New Feature | High | Complex | Done |
| 51 | [Product Reviews & Q&A](#51-product-reviews--qa) | New Feature | Medium | Simple | Done |
| 52 | [Storefront Configuration](#52-storefront-configuration) | New Feature | Medium | Medium | Done |
| 53 | [Custom Report Builder](#53-custom-report-builder) | New Feature | High | Complex | Done |
| 54 | [Data Warehouse & Materialized Views](#54-data-warehouse--materialized-views) | New Feature | Medium | Medium | Done |
| 55 | [Dashboard Widgets (Extended)](#55-dashboard-widgets-extended) | Enhancement | Medium | Simple | Done |
| 56 | [Marketplace Vendor Management](#56-marketplace-vendor-management) | New Feature | High | Complex | Done |
| 57 | [Vendor Products & Approvals](#57-vendor-products--approvals) | New Feature | High | Medium | Done |
| 58 | [Vendor Commissions & Payouts](#58-vendor-commissions--payouts) | New Feature | High | Medium | Done |
| 59 | [Vendor Reviews & Metrics](#59-vendor-reviews--metrics) | New Feature | Medium | Simple | Done |
| 60 | [Smart Pricing Engine](#60-smart-pricing-engine) | New Feature | High | Complex | Done |
| 61 | [AI Chatbot for Support](#61-ai-chatbot-for-support) | New Feature | Medium | Complex | Done |
| 62 | [Sales Predictions & Trend Analysis](#62-sales-predictions--trend-analysis) | New Feature | Medium | Medium | Done |
| 63 | [Automated Product Descriptions](#63-automated-product-descriptions) | New Feature | Medium | Medium | Done |

---

## 46. Multi-Store / Branch Management [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Complex

### Problem it solves
The existing locations system is basic — just name and address. Real multi-store operations need phone, email, manager assignment, operating hours, per-store currency/tax settings, and a primary store designation.

### Proposed solution
Enhance the locations table with rich branch metadata. Add store settings management (key-value config per store). Full CRUD with manager assignment.

### Key functionality
- Branch CRUD with phone, email, manager, opening hours, currency, tax rate
- Per-store settings (key-value)
- Primary store designation
- Manager assignment from users
- Store-specific configuration

### Technical notes
- **Migration:** `047_store_branches.sql` — extends locations table, creates store_settings
- **Route:** `server/routes/branches.ts`
- **Page:** `client/src/pages/Branches.tsx`

---

## 47. Store Performance & Consolidated Dashboard [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
No way to compare performance across stores. Sales aren't linked to locations. Management can't see which store is outperforming or underperforming.

### Proposed solution
Add location_id to sales, create store daily summaries (materialized aggregations), and build a consolidated multi-store dashboard with per-store KPIs.

### Key functionality
- Per-store sales tracking (location_id on sales)
- Daily store summaries (revenue, customers, order count, avg order value)
- Consolidated dashboard comparing stores side-by-side
- Top category per store per day

### Technical notes
- **Migration:** `048_store_performance.sql` — adds location_id to sales, creates store_daily_summary
- **Route:** consolidated dashboard endpoint in branches.ts
- **Page:** Dashboard tab in Branches.tsx

---

## 48. Inter-Store Stock Transfers [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
Stock transfers between locations exist but lack workflow management — no expected dates, reference numbers, approval flows, or detailed item tracking.

### Proposed solution
Enhance transfer system with transfer requests workflow: create request → approve → process transfer. Track expected dates and reference numbers.

### Key functionality
- Transfer request CRUD with items
- Approval workflow (pending → approved → processing → completed → cancelled)
- Expected delivery dates
- Reference numbers for tracking
- Approval by authorized users

### Technical notes
- **Migration:** `049_inter_store_transfers.sql` — extends stock_transfers, creates transfer_requests + items
- **Route:** transfer request endpoints in branches.ts

---

## 49. E-commerce Customer Accounts [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Complex

### Problem it solves
Customers have no online presence — no email, password, registration status, or profile info. E-commerce requires self-service customer accounts with authentication.

### Proposed solution
Extend customers with registration fields (email, password, avatar, date of birth, gender). Add customer addresses (shipping/billing) and wishlists.

### Key functionality
- Customer registration fields (email, password_hash, is_registered)
- Profile data (avatar, DOB, gender)
- Multiple addresses per customer (home, work, etc.) with default selection
- Wishlist (customer × product, unique pairs)

### Technical notes
- **Migration:** `050_ecommerce_customers.sql` — extends customers, creates customer_addresses + wishlists
- **Route:** public storefront endpoints in storefront.ts

---

## 50. Online Orders & Storefront [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Complex

### Problem it solves
No online sales channel. The system is purely POS-based. Customers can't browse products, place orders, or track deliveries online. Revenue is limited to physical foot traffic.

### Proposed solution
Full e-commerce order system: online order lifecycle management, shopping carts, stock deduction on order, status workflow, and public order tracking.

### Key functionality
- Online order CRUD with status workflow (pending → confirmed → processing → shipped → delivered → cancelled)
- Shopping cart persistence
- Stock deduction on order creation, restoration on cancellation
- Public order tracking by order number
- Payment tracking (method, reference, paid status)
- Shipping address and customer linking

### Technical notes
- **Migrations:** `051_online_orders.sql` (online_orders, order_items, shopping_carts), `052_product_reviews.sql`, `053_storefront_config.sql`
- **Routes:** `server/routes/storefront.ts`, `server/routes/onlineOrders.ts`
- **Pages:** `client/src/pages/Storefront.tsx`, `client/src/pages/OnlineOrders.tsx`

---

## 51. Product Reviews & Q&A [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Simple

### Problem it solves
No customer feedback on individual products. Online shoppers rely heavily on reviews and ratings to make purchasing decisions. Q&A allows customers to ask about products before buying.

### Proposed solution
Product reviews with 1-5 star ratings and product Q&A system. Reviews verified against actual purchases.

### Technical notes
- **Migration:** `052_product_reviews.sql` — creates product_reviews + product_questions tables

---

## 52. Storefront Configuration [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
No way to configure the online storefront appearance — store name, colors, banners, shipping settings. Every storefront needs basic configuration.

### Proposed solution
Key-value storefront configuration with default values. Banner management for promotional content on the storefront.

### Technical notes
- **Migration:** `053_storefront_config.sql` — creates storefront_config + storefront_banners, seeds defaults

---

## 53. Custom Report Builder [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Complex

### Problem it solves
Reports are hardcoded. Admins can't create custom queries, combine fields from different tables, or save report configurations for reuse. Business intelligence requires flexibility.

### Proposed solution
Saved report builder with configurable type, fields, filters, grouping, and chart options. Quick ad-hoc report endpoints for common queries. Scheduled report delivery.

### Key functionality
- Saved report CRUD with JSON configuration
- Report types: sales, inventory, customers, financial
- Quick reports: revenue by date/category, top products
- Scheduled reports with cron expressions and email delivery
- Multiple chart types (bar, line, pie, table)

### Technical notes
- **Migrations:** `054_report_builder.sql` (saved_reports, scheduled_reports)
- **Route:** `server/routes/reports.ts`
- **Page:** `client/src/pages/ReportBuilder.tsx`

---

## 54. Data Warehouse & Materialized Views [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
Complex analytics queries are slow on transactional data. No pre-aggregated data for dashboards. Need materialized views for monthly sales, product performance, and customer lifetime value.

### Technical notes
- **Migration:** `055_data_warehouse.sql` — creates monthly_sales_agg, product_performance, customer_ltv

---

## 55. Dashboard Widgets (Extended) [DONE]

**Type:** Enhancement
**Priority:** Medium
**Complexity:** Simple

### Problem it solves
Dashboard customization from Wave 2 needs extended widget types for the new data sources (multi-store, e-commerce, vendor metrics).

### Technical notes
- **Migration:** `056_dashboard_widgets.sql` — creates dashboard_widgets table

---

## 56. Marketplace Vendor Management [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Complex

### Problem it solves
The system is single-seller only. A marketplace model allows multiple vendors to sell through the platform, each managing their own inventory and receiving their own payouts. This is the foundation for a multi-vendor ecosystem.

### Proposed solution
Full vendor lifecycle: registration, approval, profile management, commission configuration, balance tracking, and payout management.

### Key functionality
- Vendor CRUD with status workflow (pending → active → suspended)
- Commission rates per vendor (percentage)
- Vendor balance tracking
- Bank details for payouts
- Payout processing with balance deduction
- Vendor dashboard stats

### Technical notes
- **Migration:** `057_vendors.sql` — creates vendors table
- **Route:** `server/routes/vendors.ts`
- **Page:** `client/src/pages/Vendors.tsx`

---

## 57. Vendor Products & Approvals [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
Vendors need to manage their own products, but the marketplace owner needs approval control. Products must be linked to vendors and flagged as marketplace items.

### Technical notes
- **Migration:** `058_vendor_products.sql` — adds vendor_id/is_marketplace to products, creates vendor_product_approvals

---

## 58. Vendor Commissions & Payouts [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Medium

### Problem it solves
Need to track commission earned per vendor per sale and manage periodic payouts. Without this, the marketplace has no revenue model.

### Technical notes
- **Migration:** `059_vendor_commissions.sql` — creates vendor_commissions + vendor_payouts tables

---

## 59. Vendor Reviews & Metrics [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Simple

### Problem it solves
No way to rate vendors or track vendor performance metrics. Buyers need trust signals; marketplace owners need quality control.

### Technical notes
- **Migration:** `060_vendor_reviews.sql` — creates vendor_reviews + vendor_metrics tables

---

## 60. Smart Pricing Engine [DONE]

**Type:** New Feature
**Priority:** High
**Complexity:** Complex

### Problem it solves
Pricing is completely manual. No demand-based adjustments, no seasonal pricing rules, no competitive awareness. Modern retail uses dynamic pricing to maximize revenue and move inventory.

### Proposed solution
Rule-based pricing engine with demand-based suggestions. Rules can target categories or specific products. AI generates price suggestions based on sales velocity, stock levels, and seasonality.

### Key functionality
- Pricing rules CRUD (name, type, conditions, adjustment percentage, schedule)
- Demand-based price suggestion generation
- Accept/reject suggestions with one click
- Rule targeting by category or product
- Season-aware pricing

### Technical notes
- **Migration:** `061_smart_pricing.sql` — creates pricing_rules + price_suggestions
- **Route:** `server/routes/ai.ts`
- **Page:** `client/src/pages/SmartPricing.tsx`

---

## 61. AI Chatbot for Support [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Complex

### Problem it solves
Customer support is entirely manual. Common questions about orders, products, shipping, and returns could be handled automatically. A chatbot reduces support load and provides 24/7 availability.

### Proposed solution
Knowledge-base-driven chatbot with keyword matching and product search. Maintains session context for multi-turn conversations.

### Technical notes
- **Migration:** `062_ai_chatbot.sql` — creates chat_sessions, chat_messages, knowledge_base + seeds FAQ
- **Route:** chatbot endpoints in ai.ts

---

## 62. Sales Predictions & Trend Analysis [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
No forward-looking analytics. The system reports what happened but can't predict what will happen. Inventory planning and marketing need forecasts.

### Proposed solution
Weighted moving average sales predictions with confidence scoring. Trend analysis (up/down/stable) for key metrics over time.

### Technical notes
- **Migration:** `063_sales_predictions.sql` — creates sales_predictions + trend_analysis
- **Route:** prediction endpoints in ai.ts
- **Page:** `client/src/pages/AiInsights.tsx`

---

## 63. Automated Product Descriptions [DONE]

**Type:** New Feature
**Priority:** Medium
**Complexity:** Medium

### Problem it solves
Writing product descriptions is time-consuming, especially for large catalogs. SEO-optimized descriptions require skill. AI can generate descriptions from product attributes.

### Proposed solution
Template-based description generation from product attributes (name, category, price, tags). Includes SEO title and description. Tracks generation history.

### Technical notes
- **Migration:** `064_auto_descriptions.sql` — adds ai_description, seo_title, seo_description, tags, image_embedding to products. Creates ai_generation_log.
- **Route:** auto-description endpoints in ai.ts

---

## Wave 3 — Implementation Status

All 18 features from Wave 3 have been implemented across 5 major areas:

- **Multi-Store**: Branch management, store performance tracking, inter-store transfers
- **E-commerce**: Customer accounts, online orders, product reviews, storefront config
- **Advanced Reporting**: Custom report builder, data warehouse views, dashboard widgets
- **Marketplace**: Vendor management, product approvals, commissions/payouts, reviews
- **AI-Powered**: Smart pricing, chatbot, sales predictions, auto descriptions

*Wave 3 completed as of Feb 2026.*
