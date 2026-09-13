export interface CreditEntry {
  id: number;
  customer_id: number;
  delta: number;
  reason: string;
  source_type: CreditSourceType;
  source_id: string | null;
  created_by: number | null;
  created_at: string;
}

export type CreditSourceType = 'exchange' | 'refund' | 'sale' | 'manual';

export interface CreditBalance {
  customer_id: number;
  balance: number;
  entries: CreditEntry[];
}

export interface IssueCreditInput {
  customer_id: number;
  amount: number;
  reason: string;
  source_type: CreditSourceType;
  source_id?: string | null;
  created_by?: number | null;
}
