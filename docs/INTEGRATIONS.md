# Integrations & Services

## Twilio (SMS & WhatsApp)

### Overview

Twilio is used to send SMS and WhatsApp messages for delivery status updates. It is **optional** — if not configured, messages are logged to console instead.

### Configuration

Set these environment variables in `server/.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1234567890
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### Behavior

- **Configured**: Messages sent via Twilio API. SID logged on success.
- **Not configured** (default): Messages skipped with console log:
  ```
  [Twilio SMS skipped - not configured] To: +1234567890 | Your order is on the way
  ```
- **Placeholder SID** (`ACxx...`): Treated as not configured (skip).
- **Send failure**: Error logged, no exception thrown — delivery status still updates.

### Service API (`server/services/twilio.ts`)

```typescript
sendSMS(phone: string, message: string): Promise<MessageInstance | null>
sendWhatsApp(phone: string, message: string): Promise<MessageInstance | null>
```

### Usage

Called from delivery route handlers when order status changes:

```typescript
import { sendSMS, sendWhatsApp } from '../services/twilio';

// On status update
await sendSMS(order.phone, `Your order ${order.order_number} is out for delivery`);
```

---

## Notification System

### Overview

In-app notifications stored in the `notifications` table. Created server-side via the notifications service, displayed client-side in the notification bell.

### Service API (`server/services/notifications.ts`)

```typescript
// Generic notification (to specific user or broadcast to all Admins)
createNotification({
  userId: number | null,  // null = broadcast to all Admins
  type: string,
  title: string,
  message?: string,
  entityType?: string,
  entityId?: string | number,
  link?: string,
});

// Convenience helpers
notifyLowStock(productName, stock, productId);
notifySale(total, saleId, cashierName);
notifyDeliveryOverdue(orderNumber, orderId, assignedTo);
```

### Notification Types

| Type | Trigger | Recipients |
|------|---------|-----------|
| `low_stock` | Product stock drops below `min_stock` | All Admins |
| `new_sale` | Sale completed | All Admins |
| `delivery_overdue` | Delivery past estimated time | Assigned driver + all Admins |

### Client-Side

Notifications are fetched via `GET /api/notifications` and displayed in a dropdown. Users can mark individual notifications as read or mark all as read.

---

## Barcode System

### Scanning (Quagga2)

The `BarcodeScanner` component (`client/src/components/BarcodeScanner.tsx`) uses `@ericblade/quagga2` for camera-based barcode reading:

- Opens device camera (rear-facing preferred)
- Scans EAN-13, EAN-8, UPC-A, UPC-E, Code128, Code39 formats
- On successful scan: calls `/api/products/barcode/:code` to look up product
- Falls back to manual barcode text input

### Generation (JsBarcode)

Products display barcodes generated client-side using `jsbarcode`:
- Used in the Barcode Tools page (`/barcode`) for printing labels
- Label templates are configurable via `/api/label-templates`
- Advanced WYSIWYG label designer available

---

## PDF & CSV Export

### Libraries

- **jspdf** — PDF generation
- **html2canvas** — HTML-to-canvas rendering for PDF screenshots
- **Native** — CSV generated as plain text with download

### Export Routes (`/api/exports`)

```
POST /api/exports/products    — Export products (CSV or PDF)
POST /api/exports/sales       — Export sales data (CSV or PDF)
POST /api/exports/analytics   — Export analytics dashboard (PDF)
```

### Client-Side Export

The Exports page (`/exports`) provides a UI for selecting export type, format, date range, and filters. Reports can also be exported from the Report Builder (`/report-builder`).

---

## File Upload (Multer)

### Configuration

Product images are uploaded via `multer` middleware:

- **Storage**: Local filesystem at `server/uploads/`
- **Serving**: Static files at `http://localhost:3001/uploads/`
- **Helmet config**: `crossOriginResourcePolicy: 'cross-origin'` allows cross-origin image loading

### Usage

Product create/update endpoints accept `multipart/form-data` with an image file field. The image URL is stored in the `products.image_url` column.

---

## AI Features

### AI Chatbot (`/api/ai/chat`)

Conversational AI for support queries. Conversations stored in `ai_conversations` table.

### Auto Product Descriptions (`/api/ai/describe`)

Generates product descriptions automatically based on product attributes. Results stored in `auto_descriptions` table.

### Sales Predictions (`/api/ai/predictions`)

Trend analysis and sales forecasting. Predictions stored in `sales_predictions` table.

---

## Smart Pricing Engine

The Smart Pricing feature (`/smart-pricing`) allows Admin users to create dynamic pricing rules:

- Rules stored in `smart_pricing_rules` table
- Rule types: time-based, demand-based, competitor-based
- Configuration stored as JSON
- Applied via the `/api/ai` routes (pricing analysis)
