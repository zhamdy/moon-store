// Cross-slice server contracts: entity types imported by two or more feature
// slices, plus the identity contract shared by auth and admin. Types owned by
// a single slice live in that slice's `types.ts` instead — see
// docs/plans/2026-08-20-001-refactor-client-feature-slice-architecture-plan.md (Unit 8).

import type { StructuredApiError } from '../lib/transport/types';

/** Standard API error response shape, tolerant during the structured-error rollout. */
export interface ApiErrorResponse {
  error?: string | StructuredApiError;
}

export type {
  ApiMeta,
  PaginationMeta,
  StructuredApiError,
  ValidationDetail,
} from '../lib/transport/types';

/** Product from GET /api/products (full shape) */
export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  category: string | null;
  category_id: number | null;
  category_name: string | null;
  category_code: string | null;
  distributor_id: number | null;
  distributor_name: string | null;
  image_url: string | null;
  has_variants: number;
  variant_count: number;
  variant_stock: number;
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string;
  updated_at: string;
}

/** Product variant from GET /api/products/:id/variants */
export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  barcode: string | null;
  price: number | null;
  cost_price: number;
  stock: number;
  attributes: Record<string, string>;
}

/** Category summary from GET /api/products/categories (id/name/code projection) */
export interface Category {
  id: number;
  name: string;
  code: string;
}

/** Distributor from GET /api/distributors */
export interface Distributor {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Customer from GET /api/customers */
export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  loyalty_points: number;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'Admin' | 'Cashier' | 'Delivery';

/** User from GET /api/users */
export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  last_login: string | null;
  created_at: string;
}

/** Auth responses project only the identity columns, not the audit ones */
export type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

/** Body of POST /api/auth/login and POST /api/auth/refresh */
export interface AuthResponseData {
  data: {
    accessToken: string;
    user: AuthUser;
  };
}

/**
 * Settings map from GET /api/settings. The route builds it from whatever rows
 * exist, so every key is optional.
 *
 * Loyalty settings use direct (non-reciprocal) units and canonical key names
 * — see `server/src/modules/core/settings/types.ts` and
 * docs/plans/2026-08-30-001-fix-pos-checkout-total-parity-plan.md. Read and
 * write only the canonical keys; the `loyalty_earn_rate` /
 * `loyalty_redeem_value` aliases are retained here only so this type does not
 * break while a not-yet-migrated database still returns them, and are never
 * written by the client.
 */
export interface AppSettings {
  tax_enabled?: 'true' | 'false';
  tax_rate?: string;
  tax_mode?: 'inclusive' | 'exclusive';
  loyalty_enabled?: 'true' | 'false';
  /** Canonical: points earned per 1 EGP of confirmed sale total. */
  loyalty_points_per_egp?: string;
  /** Canonical: EGP value redeemed per 1 point spent. */
  loyalty_egp_per_point?: string;
  /** @deprecated legacy alias for `loyalty_points_per_egp`; read-only compatibility. */
  loyalty_earn_rate?: string;
  /** @deprecated legacy alias for `loyalty_egp_per_point`; read-only compatibility. */
  loyalty_redeem_value?: string;
}
