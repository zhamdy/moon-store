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

/**
 * A *partial* update: absent means "leave it alone", explicit `null` means "clear it".
 * Deliberately not `CreateShippingCompanyDTO` — sharing that is what cleared `email` and
 * `tracking_url_template` on every edit and silently re-enabled a disabled company.
 */
export interface UpdateShippingCompanyDTO {
  name?: string;
  phone?: string | null;
  email?: string | null;
  tracking_url_template?: string | null;
  is_active?: boolean;
}
