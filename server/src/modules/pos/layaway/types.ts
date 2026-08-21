export interface LayawayItemInput {
  product_id: number;
  variant_id?: number | null;
  quantity: number;
  price: number;
}

export interface CreateLayawayDTO {
  customer_id: number;
  total_amount: number;
  deposit_amount: number;
  payment_method?: 'cash' | 'card';
  due_date: string;
  notes?: string;
  items: LayawayItemInput[];
}

export interface InstallmentDTO {
  amount: number;
  payment_method?: 'cash' | 'card';
  notes?: string;
}

export interface LayawayFilters {
  status?: string;
  page?: string | number;
  limit?: string | number;
  search?: string;
}

export interface LayawayPlanRow {
  id: number;
  plan_number: string;
  customer_id: number;
  total_amount: number;
  deposit_amount: number;
  remaining_balance: number;
  due_date: string;
  status: 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  created_by_name?: string;
}

export interface LayawayItemRow {
  id: number;
  plan_id: number;
  product_id: number;
  variant_id: number | null;
  quantity: number;
  price: number;
  product_name?: string;
  sku?: string;
}

export interface LayawayPaymentRow {
  id: number;
  plan_id: number;
  amount: number;
  payment_method: string;
  notes: string | null;
  cashier_id: number;
  created_at: string;
  cashier_name?: string;
}

export interface LayawayPlanDetail extends LayawayPlanRow {
  items: LayawayItemRow[];
  payments: LayawayPaymentRow[];
}
