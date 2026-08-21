export interface ShippingCompanyRecord {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  tracking_url_template?: string | null;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
  order_count?: number;
}

export interface CreateShippingCompanyDTO {
  name: string;
  phone?: string | null;
  email?: string | null;
  tracking_url_template?: string | null;
  is_active?: boolean;
}

export type UpdateShippingCompanyDTO = CreateShippingCompanyDTO;
