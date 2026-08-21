export interface VendorRecord {
  id: number;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_number?: string | null;
  commission_rate: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at?: string;
  product_count?: number;
}

export interface VendorDTO {
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_number?: string | null;
  commission_rate?: number;
  status?: 'active' | 'inactive';
}

export interface VendorPayoutRecord {
  id: number;
  vendor_id: number;
  amount: number;
  period_start?: string | null;
  period_end?: string | null;
  notes?: string | null;
  created_by: number;
  created_at: string;
  created_by_name?: string;
}

export interface CreateVendorPayoutDTO {
  amount: number;
  period_start?: string | null;
  period_end?: string | null;
  notes?: string | null;
}

export interface VendorFilters {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}
