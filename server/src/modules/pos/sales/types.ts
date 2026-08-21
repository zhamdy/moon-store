export interface SaleItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  unit_price?: number;
  memo?: string | null;
}

export interface PaymentInput {
  method: string;
  amount: number;
}

export interface CreateSaleDTO {
  items: SaleItemInput[];
  discount?: number;
  discount_type?: 'fixed' | 'percentage';
  payment_method: string;
  payments?: PaymentInput[];
  customer_id?: number | null;
  points_redeemed?: number;
  notes?: string | null;
  tip?: number;
  coupon_code?: string | null;
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  taxAmount: number;
  pointsDiscount: number;
  couponId: number | null;
  couponDiscount: number;
  tipAmount: number;
  total: number;
}

export interface TaxSettings {
  enabled: boolean;
  rate: number;
  mode: string;
}

export interface LoyaltySettings {
  enabled: boolean;
  earnRate: number;
  redeemValue: number;
}

export interface RefundItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CreateRefundDTO {
  items: RefundItemInput[];
  reason: string;
  restock: boolean;
}

export interface SaleFilters {
  page?: number;
  limit?: number;
  search?: string;
  payment_method?: string;
  cashier_id?: number;
  from?: string;
  to?: string;
}
