export interface GiftCardRecord {
  id: number;
  code: string;
  barcode: string;
  initial_value: number;
  balance: number;
  customer_id?: number | null;
  expires_at?: string | null;
  status: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  transaction_count?: number;
  total_redeemed?: number;
}

export interface CreateGiftCardDTO {
  code?: string;
  initial_value: number;
  customer_id?: number | null;
  expires_at?: string | null;
}

export interface GiftCardFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface GiftCardBalanceResult {
  code: string;
  balance: number;
  initial_value: number;
  status: string;
  expires_at: string | null;
  is_expired: boolean;
  is_redeemable: boolean;
}

export interface RedeemResult {
  transaction: Record<string, any>;
  new_balance: number;
  code: string;
}
