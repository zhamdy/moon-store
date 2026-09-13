// Types owned by the admin slice. Cross-slice contracts (User, UserRole,
// AppSettings, ...) live in `shared/types` instead.

/** One recorded action from GET /api/v1/audit-log */
export interface AuditEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_display_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string;
  ip_address: string | null;
  created_at: string;
}

/** Branch (store or warehouse) from GET /api/v1/branches */
export interface Branch {
  id: number;
  name: string;
  address: string | null;
  type: string;
  status: string;
  phone: string | null;
  email: string | null;
  manager_name: string | null;
  manager_id: number | null;
  currency: string;
  tax_rate: number;
  is_primary: number;
  product_count: number;
  total_stock: number;
  opening_hours: string | null;
}

/** One stock movement between branches, from GET /api/v1/branches/transfers */
export interface BranchTransfer {
  id: number;
  from_location_name: string;
  to_location_name: string;
  user_name: string;
  status: string;
  notes: string | null;
  created_at: string;
}

/** GET /api/v1/branches/dashboard/consolidated */
export interface ConsolidatedBranches {
  stores: {
    id: number;
    name: string;
    today_sales: number;
    today_revenue: number;
    total_stock: number;
    low_stock_count: number;
  }[];
  totals: { total_today_sales: number; total_today_revenue: number; store_count: number };
}
