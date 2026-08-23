// Types owned by the sales slice. Cross-slice contracts (Product, Customer,
// ...) live in `shared/types` instead.

/** Sale line item from GET /api/sales/:id (read shape, not the write payload) */
export interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

/** Coupon from GET /api/coupons */
export interface Coupon {
  id: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase: number | null;
  max_discount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  scope: 'all' | 'category' | 'product';
  scope_ids: number[] | null;
  stackable: number;
  status: string;
  usage_count: number;
  created_at: string;
}

/** Gift card from GET /api/gift-cards */
export interface GiftCard {
  id: number;
  code: string;
  barcode: string | null;
  initial_value: number;
  balance: number;
  status: 'active' | 'used' | 'cancelled';
  customer_id: number | null;
  customer_name: string | null;
  expires_at: string | null;
  created_at: string;
}

/** One ledger entry from GET /api/gift-cards/:id/transactions */
export interface GiftCardTransaction {
  id: number;
  gift_card_id: number;
  type: string;
  amount: number;
  reference_id: number | null;
  created_at: string;
}

/** A line being composed in the layaway form, before it is sent */
export interface LayawayLine {
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
}

/** Layaway order row from GET /api/v1/layaway */
export interface LayawayOrder {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  total: number;
  deposit: number;
  balance: number;
  due_date: string;
  status: string;
  created_at: string;
}

/** GET /api/v1/layaway/:id — the list row plus its lines and payments */
export interface LayawayDetail extends LayawayOrder {
  items: { id: number; product_name: string; quantity: number; unit_price: number }[];
  payments: {
    id: number;
    amount: number;
    payment_method: string;
    cashier_name: string;
    created_at: string;
  }[];
}

/** A sale row from GET /api/v1/sales. */
export interface Sale {
  id: number;
  total: number;
  discount: number | null;
  discount_type: 'fixed' | 'percentage' | null;
  payment_method: string;
  cashier_id: number;
  cashier_name: string;
  items_count: number;
  created_at: string;
  refund_status: 'partial' | 'full' | null;
  refunded_amount: number | null;
  customer_id: number | null;
  customer_name: string | null;
}

/** The aggregate figures GET /api/v1/sales returns beside the rows. */
export interface SalesMeta {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  aggregates: { totalRevenue: number; totalSales: number };
}

/** GET /api/v1/sales/:id — the same sale, with its lines attached. */
export interface SaleDetail {
  id: number;
  total: number;
  discount: number | null;
  discount_type: string | null;
  payment_method: string;
  cashier_name: string | null;
  created_at: string;
  items: SaleItem[];
}

/** One refund against a sale, from GET /api/v1/sales/:id/refunds. */
export interface SaleRefund {
  id: number;
  amount: number;
  reason: string;
  cashier_name: string | null;
  created_at: string;
  items: SaleItem[];
}
