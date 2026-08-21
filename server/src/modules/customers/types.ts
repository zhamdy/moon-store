export interface CustomerRecord {
  id: number;
  name: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerDTO {
  name: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
}

export type UpdateCustomerDTO = CreateCustomerDTO;

export interface CustomerFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CustomerStats {
  total_spent: number;
  order_count: number;
  avg_order: number;
  last_purchase: string | null;
}
