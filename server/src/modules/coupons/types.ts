export interface CouponRecord {
  id: number;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase?: number | null;
  max_discount?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  max_uses_per_customer?: number | null;
  scope: 'all' | 'category' | 'product';
  scope_ids?: number[] | null;
  stackable: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}

export interface CreateCouponDTO {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase?: number | null;
  max_discount?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  max_uses_per_customer?: number | null;
  scope: 'all' | 'category' | 'product';
  scope_ids?: number[] | null;
  stackable: boolean;
}

export type UpdateCouponDTO = CreateCouponDTO;

export interface CouponFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface ValidateCouponDTO {
  code: string;
  subtotal: number;
  customer_id?: number | null;
  item_product_ids?: number[] | null;
}

export interface ValidateCouponResult {
  coupon_id: number;
  code: string;
  type: string;
  value: number;
  discount: number;
  stackable: boolean;
}
