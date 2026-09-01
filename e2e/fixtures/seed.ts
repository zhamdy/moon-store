/**
 * API-seeded fixture data, namespaced per worker.
 *
 * Everything is created through the real HTTP API rather than by direct insert, so
 * fixture data passes the same validation and invariants as production data. Three rules
 * keep the parallel model honest:
 *
 *   1. Every test creates the rows it mutates. Never mutate shared seed rows.
 *   2. Assert on scoped locators, never "the first row" or "3 items".
 *   3. Never assert on a global aggregate from a parallel worker.
 */
import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../support/config';
import type {
  CreatedUser,
  Envelope,
  LoginData,
  Product,
  RegisterSession,
  Role,
  Shift,
} from './types';

export const API_BASE = `${API_URL}/api/v1`;

/** Cashier password for every worker-owned account. Disposable database, published creds. */
export const WORKER_PASSWORD = 'e2e-cashier-password';

export interface SeededAccounts {
  admin: { email: string; password: string };
  cashier: { email: string; password: string };
  delivery: { email: string; password: string };
}

/**
 * The accounts `server/src/database/seed.ts` creates. A spec may *authenticate* as one of
 * these, but must never mutate its shift, register, or sale state: `register_sessions`
 * allows one open session per cashier and carries `expected_cash` as a running
 * accumulator, and `shifts` has the same one-active-per-user shape. Two workers driving
 * the shared cashier would have one register-open fail outright and the other's balance
 * assertions race.
 */
export const SEEDED: SeededAccounts = {
  admin: { email: 'admin@moon.com', password: 'admin123' },
  cashier: { email: 'sarah@moon.com', password: 'cashier123' },
  delivery: { email: 'james@moon.com', password: 'delivery123' },
};

async function unwrap<T>(
  response: Awaited<ReturnType<APIRequestContext['post']>>,
  what: string
): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${what} failed: ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as Envelope<T>;
  if (body.data === null || body.data === undefined) {
    // `shifts/current` and `register/current` legitimately answer 200 with `{ data: null }`
    // when nothing is open. Returning that as T would surface later as a null dereference
    // inside a spec — which reads as an application bug rather than "nothing is open".
    // Callers that treat null as a real answer should use `getJsonOrNull`.
    throw new Error(`${what}: server returned 200 with no data.`);
  }
  return body.data;
}

export async function login(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<LoginData> {
  const response = await request.post(`${API_BASE}/auth/login`, { data: { email, password } });
  return unwrap<LoginData>(response, `login as ${email}`);
}

/**
 * Omit the token when the caller's request context already carries the header — the
 * worker-scoped `adminApi` does. Optional rather than an empty-string sentinel, so
 * "deliberately omitted" is visible in the type and cannot be confused with a token
 * variable that happened to be empty (which would send no Authorization at all and
 * surface as a 401 that reads like an auth bug).
 */
function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function createUser(
  request: APIRequestContext,
  user: { name: string; email: string; password: string; role: Role },
  adminToken?: string
): Promise<CreatedUser> {
  const response = await request.post(`${API_BASE}/users`, {
    headers: authHeaders(adminToken),
    data: user,
  });
  return unwrap<CreatedUser>(response, `create user ${user.email}`);
}

export async function clockIn(request: APIRequestContext, token: string): Promise<Shift> {
  // `branch_id` is optional and FKs to `branches`; omitted deliberately so the fixture
  // does not depend on a seeded branch.
  const response = await request.post(`${API_BASE}/shifts/clock-in`, {
    headers: authHeaders(token),
    data: {},
  });
  return unwrap<Shift>(response, 'clock in');
}

export async function openRegister(
  request: APIRequestContext,
  token: string,
  openingFloat: number
): Promise<RegisterSession> {
  // `opening_float` is a JSON number, not a string — the Zod schema is `z.number().min(0)`.
  const response = await request.post(`${API_BASE}/register/open`, {
    headers: authHeaders(token),
    data: { opening_float: openingFloat },
  });
  return unwrap<RegisterSession>(response, 'open register');
}

export interface ProductSeed {
  name?: string;
  price?: number;
  stock?: number;
  minStock?: number;
  /** Omit to leave the product without a barcode; `products.barcode` is UNIQUE. */
  barcode?: string;
}

/**
 * Mints a product owned by one test.
 *
 * SKU and barcode are derived from the worker namespace rather than from
 * `GET /products/generate-sku/:categoryId`, which is an unlocked `MAX(...)+1` read: two
 * workers asking for one get the same value and the loser's create fails with a confusing
 * 409 mid-test.
 */
export interface CreateProductOptions extends ProductSeed {
  /** Worker+test namespace the SKU is derived from. */
  namespace: string;
  /** Short label distinguishing products within one test. */
  label: string;
  /** Omit when the request context already carries an admin header. */
  adminToken?: string;
}

export async function createProduct(
  request: APIRequestContext,
  { namespace, label, adminToken, ...seed }: CreateProductOptions
): Promise<Product> {
  const unique = `${namespace}-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const response = await request.post(`${API_BASE}/products`, {
    headers: authHeaders(adminToken),
    data: {
      name: seed.name ?? unique,
      sku: unique.toUpperCase(),
      barcode: seed.barcode ?? null,
      price: seed.price ?? 100,
      stock: seed.stock ?? 10,
      min_stock: seed.minStock ?? 0,
    },
  });
  return unwrap<Product>(response, `create product ${unique}`);
}

/** For endpoints where `{ data: null }` is a meaningful answer, not an error. */
export async function getJsonOrNull<T>(
  request: APIRequestContext,
  token: string,
  path: string
): Promise<T | null> {
  const response = await request.get(`${API_BASE}/${path}`, { headers: authHeaders(token) });
  if (!response.ok()) {
    throw new Error(`GET ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return ((await response.json()) as Envelope<T | null>).data ?? null;
}

export async function getJson<T>(
  request: APIRequestContext,
  token: string,
  path: string
): Promise<T> {
  const response = await request.get(`${API_BASE}/${path}`, { headers: authHeaders(token) });
  return unwrap<T>(response, `GET ${path}`);
}
