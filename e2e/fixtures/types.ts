/**
 * The API shapes the fixtures depend on. Narrow on purpose — these mirror only the fields
 * the suite reads, so an unrelated response change does not ripple through the harness.
 *
 * The success envelope is `{ data }` (plus `meta` on list endpoints). There is no
 * `success` boolean; errors are `{ error: { code, message, details? } }`.
 */

export type Role = 'Admin' | 'Cashier' | 'Delivery';

export interface Envelope<T> {
  data: T;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface LoginData {
  accessToken: string;
  user: AuthUser;
}

export interface CreatedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface Shift {
  id: number;
  user_id: number;
  clock_in: string;
  clock_out: string | null;
  status: 'active' | 'on_break' | 'completed';
}

export interface RegisterSession {
  id: number;
  cashier_id: number;
  /** pg NUMERIC — arrives as a string. Never compare it to a JS number directly. */
  opening_float: string | number;
  expected_cash: string | number;
  status: 'open' | 'closed';
  opened_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  price: number | string;
  stock: number;
  category_id: number | null;
  min_stock: number;
}

/** Credentials for one of the accounts the fixtures authenticate as. */
export interface Credentials {
  email: string;
  password: string;
}

/** Playwright's storage-state shape, narrowed to what the fixtures build. */
export interface StorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
}

/** A cashier owned by exactly one worker, with its own shift and register. */
export interface WorkerCashier extends Credentials {
  id: number;
  name: string;
  workerIndex: number;
  /** `e2e-w{N}` — the prefix every row this worker creates must carry. */
  namespace: string;
  accessToken: string;
  /** A complete session: the moon-auth entry AND the httpOnly refresh cookie. */
  storageState: StorageState;
}
