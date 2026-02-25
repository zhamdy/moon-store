# Smoke Test Checklist

Manual verification checklist for the Moon Store application. Run through after deployments or major changes.

## Prerequisites

```bash
# Terminal 1 — Start server
cd server && npm run migrate && npm run seed && npm run dev

# Terminal 2 — Start client
cd client && npm run dev
```

Server: http://localhost:3001 | Client: http://localhost:5173

---

## 1. Health & Connectivity

- [ ] `GET http://localhost:3001/api/health` returns `{ success: true, data: { status: "ok" } }`
- [ ] Client loads at http://localhost:5173 without console errors
- [ ] No CORS errors in browser console

---

## 2. Authentication

### Login
- [ ] Navigate to `/login` — login form appears
- [ ] Login with `admin@moon.com` / `admin123` — redirects to Dashboard (`/`)
- [ ] Login with `sarah@moon.com` / `cashier123` — redirects to POS (`/pos`)
- [ ] Login with `james@moon.com` / `delivery123` — redirects to Deliveries (`/deliveries`)
- [ ] Wrong password shows error toast
- [ ] Wrong email shows error toast

### Session
- [ ] Refresh page — stays logged in (token persisted)
- [ ] Logout button works — redirects to `/login`
- [ ] After logout, accessing `/` redirects to `/login`

### Role Access
- [ ] As Cashier: cannot access `/` (Dashboard) — redirected
- [ ] As Delivery: cannot access `/pos` — redirected
- [ ] As Admin: can access all pages

---

## 3. Dashboard (Admin)

- [ ] KPI cards load (revenue, orders, customers)
- [ ] Revenue chart renders with data
- [ ] Top products list populated
- [ ] Payment methods chart renders
- [ ] No loading spinners stuck indefinitely

---

## 4. POS (Admin/Cashier)

### Product Selection
- [ ] Products grid loads with items
- [ ] Search filters products by name
- [ ] Category filter works
- [ ] Clicking product adds to cart

### Cart
- [ ] Cart panel shows added items
- [ ] Quantity increment/decrement works
- [ ] Remove item from cart works
- [ ] Discount (flat/percentage) applies correctly
- [ ] Cart total updates in real-time

### Checkout
- [ ] Checkout button opens checkout sheet
- [ ] Payment method selection works (Cash, Card, etc.)
- [ ] Complete sale — success toast
- [ ] Stock decremented after sale
- [ ] Sale appears in Sales History

### Barcode
- [ ] Manual barcode entry finds product
- [ ] Camera scanner opens (if device has camera)

---

## 5. Inventory (Admin/Cashier)

- [ ] Products table loads with pagination
- [ ] Search by name/SKU works
- [ ] Category filter works
- [ ] Add new product form works (Admin)
- [ ] Edit product updates correctly
- [ ] Delete product works (Admin)
- [ ] Low stock indicator visible on low-stock items
- [ ] Product image upload works

---

## 6. Sales History (Admin/Cashier)

- [ ] Sales table loads
- [ ] Date range filter works
- [ ] Click sale shows detail with line items
- [ ] Refund flow works (Admin) — full or partial
- [ ] Revenue totals display correctly

---

## 7. Deliveries (Admin/Delivery)

- [ ] Delivery orders list loads
- [ ] Create new delivery order (Admin)
- [ ] Assign delivery driver
- [ ] Status update works (Pending → Preparing → Out for Delivery → Delivered)
- [ ] Delivery user sees only their assigned orders
- [ ] SMS/WhatsApp notification logged in console (if Twilio not configured)

---

## 8. Customers (Admin)

- [ ] Customer list loads
- [ ] Add new customer
- [ ] Edit customer details
- [ ] View customer purchase history
- [ ] Loyalty points displayed

---

## 9. Categories & Distributors (Admin)

- [ ] Categories list loads, CRUD works
- [ ] Distributors list loads, CRUD works

---

## 10. Purchase Orders (Admin)

- [ ] PO list loads
- [ ] Create new PO with items
- [ ] Receive PO — stock updated

---

## 11. Cash Register (Admin/Cashier)

- [ ] Open register with opening amount
- [ ] Cash in/out transactions work
- [ ] Close register — summary displayed

---

## 12. Additional Features (Admin)

Quick checks — each page loads without errors:

- [ ] `/promotions` — Coupons management
- [ ] `/gift-cards` — Gift card management
- [ ] `/stock-count` — Stock count sessions
- [ ] `/shifts` — Shift clock in/out
- [ ] `/expenses` — Expense tracking
- [ ] `/segments` — Customer segments
- [ ] `/layaway` — Layaway orders
- [ ] `/collections` — Season/collection management
- [ ] `/warranty` — Warranty claims
- [ ] `/feedback` — Customer feedback/NPS
- [ ] `/backup` — Backup & restore
- [ ] `/activity` — Activity feed
- [ ] `/exports` — Data exports
- [ ] `/branches` — Store branches
- [ ] `/storefront` — Storefront config
- [ ] `/online-orders` — Online order management
- [ ] `/report-builder` — Custom report builder
- [ ] `/vendors` — Marketplace vendors
- [ ] `/smart-pricing` — Smart pricing rules
- [ ] `/ai-insights` — AI chatbot & insights
- [ ] `/audit-log` — Audit log viewer
- [ ] `/settings` — System settings

---

## 13. UI/UX

### Theme
- [ ] Light mode renders correctly
- [ ] Dark mode toggle works — colors switch properly
- [ ] Charts re-render with correct colors on theme change

### Language / RTL
- [ ] English mode — LTR layout, English labels
- [ ] Arabic mode — RTL layout, Arabic labels
- [ ] Sidebar flips to right side in RTL
- [ ] All text alignment follows logical direction
- [ ] Cart sheet opens from correct side (right in LTR, left in RTL)

### Responsive
- [ ] Desktop (>1024px) — sidebar visible
- [ ] Mobile (<1024px) — sidebar collapsed, hamburger menu works
- [ ] Tables horizontally scrollable on mobile
- [ ] POS layout usable on tablet

### Notifications
- [ ] Notification bell in header shows count
- [ ] Clicking shows notification dropdown
- [ ] Mark as read works
- [ ] Mark all as read works

---

## 14. PWA

- [ ] Install prompt appears after 30s (first visit)
- [ ] App installable as PWA
- [ ] Offline banner shows when network disconnected
- [ ] Offline sale queued successfully
- [ ] Sales sync when back online

---

## 15. Data Integrity

- [ ] Creating a sale deducts stock correctly
- [ ] Refund restocks items (when restock option selected)
- [ ] Exchange flow: return + new sale in one transaction
- [ ] Layaway payments reduce remaining balance
- [ ] Purchase order receipt increases stock
- [ ] Stock adjustments (add/remove) reflect in inventory
- [ ] Gift card redemption reduces balance

---

## 16. Error Handling

- [ ] Invalid API route returns proper JSON error
- [ ] 401 on expired token triggers silent refresh
- [ ] Rate limiter triggers after 200 requests in 15min
- [ ] Server errors show user-friendly message (not stack trace in production)
- [ ] ErrorBoundary catches rendering errors — shows fallback UI
