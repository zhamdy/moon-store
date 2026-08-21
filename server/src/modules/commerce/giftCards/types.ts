export interface GiftCardFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface GiftCardListResult {
  rows: Record<string, any>[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateGiftCardInput {
  code?: string;
  initial_value: number;
  customer_id?: number | null;
  expires_at?: string | null;
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
