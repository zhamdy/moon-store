/**
 * A namespaced customer with a known loyalty balance.
 *
 * Loyalty needs one and no other fixture creates one: points live on
 * `customers.loyalty_points`, and the sale service refuses redemption outright without a
 * customer, while every other spec in the suite rings up anonymous sales.
 *
 * `customers.phone` is `UNIQUE NOT NULL`, so the phone is namespaced too — a hardcoded
 * test number collides across re-runs and with anything a parallel worker left behind,
 * even though this fixture is only used from the serial project.
 */
import type { APIRequestContext } from '@playwright/test';
import { API_BASE } from './seed';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  loyalty_points?: number;
}

export async function createCustomer(
  request: APIRequestContext,
  namespace: string,
  label: string
): Promise<Customer> {
  const unique = `${namespace}-${label}-${Date.now().toString(36)}`;
  // Digits only, and namespaced by a monotonic clock plus randomness so two runs cannot
  // generate the same number.
  const phone = `01${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 10)}`;

  const response = await request.post(`${API_BASE}/customers`, {
    data: { name: unique, phone },
  });
  if (!response.ok()) {
    throw new Error(`create customer failed: ${response.status()} ${await response.text()}`);
  }
  return ((await response.json()) as { data: Customer }).data;
}

/** Credits a known starting balance. Admin-only, and the only way to seed points. */
export async function grantLoyaltyPoints(
  request: APIRequestContext,
  customerId: number,
  points: number
): Promise<number> {
  const response = await request.post(`${API_BASE}/customers/${customerId}/loyalty/adjust`, {
    data: { points, note: 'e2e seed' },
  });
  if (!response.ok()) {
    throw new Error(`loyalty adjust failed: ${response.status()} ${await response.text()}`);
  }
  return ((await response.json()) as { data: { loyalty_points: number } }).data.loyalty_points;
}

export async function readLoyaltyPoints(
  request: APIRequestContext,
  customerId: number
): Promise<number> {
  const response = await request.get(`${API_BASE}/customers/${customerId}/loyalty`);
  if (!response.ok()) {
    throw new Error(`read loyalty failed: ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as { data: { loyalty_points?: number; points?: number } };
  return body.data.loyalty_points ?? body.data.points ?? 0;
}
